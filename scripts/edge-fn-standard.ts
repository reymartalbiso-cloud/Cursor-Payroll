import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushPayload {
    to: string | string[];
    title: string;
    body: string;
    data?: any;
    sound?: string;
    priority?: 'default' | 'normal' | 'high';
}

async function sendPushNotifications(payloads: PushPayload[]) {
    if (payloads.length === 0) return;

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(payloads),
    });

    const result = await response.json();
    console.log('Push result:', result);
    return result;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        const VALID_API_KEY = Deno.env.get('LIFESCAN_API_KEY') || 'ls_sk_9d8f7a6c5b4e3d2a1f0e9d8c7b6a5';

        if (!authHeader || authHeader !== `Bearer ${VALID_API_KEY}`) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Handle GET
        if (req.method === 'GET') {
            const url = new URL(req.url);
            const action = url.searchParams.get('action') || 'get_dtr_records';
            const userId = url.searchParams.get('user_id');
            const startDate = url.searchParams.get('start_date');
            const endDate = url.searchParams.get('end_date');

            if (action === 'get_users_with_dtr') {
                let query = supabaseAdmin
                    .from('profiles')
                    .select(`
            id,
            first_name,
            last_name,
            middle_name,
            email,
            department,
            position,
            employee_id,
            dtr (*)
          `);

                if (userId) query = query.eq('id', userId);

                const { data, error } = await query.order('last_name', { ascending: true });
                if (error) throw error;

                let result = data;
                if (startDate || endDate) {
                    result = data?.map((profile: any) => ({
                        ...profile,
                        dtr: profile.dtr?.filter((record: any) => {
                            const recordDate = record.created_at ? record.created_at.split('T')[0] : null;
                            if (!recordDate) return false;
                            if (startDate && recordDate < startDate) return false;
                            if (endDate && recordDate > endDate) return false;
                            return true;
                        })
                    }));
                }

                return new Response(JSON.stringify(result), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            // Default action: get_dtr_records
            let query = supabaseAdmin
                .from('dtr')
                .select(`
          *,
          profiles (id, first_name, last_name, middle_name, email, department, position, employee_id)
        `);

            if (userId) query = query.eq('user_id', userId);
            if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
            if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

            const { data, error } = await query.order('created_at', { ascending: false }).limit(2000);
            if (error) throw error;
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // Handle POST
        if (req.method === 'POST') {
            const body = await req.json();
            const { action, title, message, targets, type } = body;

            if (action === 'broadcast') {
                const { error: annError } = await supabaseAdmin.from('announcements').insert({ title, message });
                if (annError) throw annError;

                const { data: tokens, error: tokenError } = await supabaseAdmin.from('user_push_tokens').select('token');
                if (tokenError) throw tokenError;

                const uniqueTokens = [...new Set((tokens || []).map(t => t.token))];
                if (uniqueTokens.length > 0) {
                    const pushPayloads = uniqueTokens.map(token => ({ to: token, title, body: message, sound: 'default' }));
                    await sendPushNotifications(pushPayloads);
                }
                return new Response(JSON.stringify({ success: true, message: 'Broadcast sent' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (action === 'direct') {
                if (!Array.isArray(targets)) throw new Error('Targets must be an array');
                const notificationsToInsert = targets.map(t => ({
                    user_id: t.user_id, title: t.title, message: t.message, type: type || 'system', unread: true
                }));
                const { error: notifError } = await supabaseAdmin.from('notifications').insert(notificationsToInsert);
                if (notifError) throw notifError;

                const userIds = targets.map(t => t.user_id);
                const { data: tokens, error: tokenError } = await supabaseAdmin.from('user_push_tokens').select('user_id, token').in('user_id', userIds);
                if (tokenError) throw tokenError;

                const pushPayloads: PushPayload[] = [];
                targets.forEach(target => {
                    const userTokens = tokens?.filter(tk => tk.user_id === target.user_id).map(tk => tk.token) || [];
                    userTokens.forEach(token => {
                        pushPayloads.push({ to: token, title: target.title, body: target.message, sound: 'default', data: target.metadata });
                    });
                });
                if (pushPayloads.length > 0) await sendPushNotifications(pushPayloads);
                return new Response(JSON.stringify({ success: true, message: 'Direct notifications sent' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            // STANDARDIZED: Accept both 'send_payslip' and 'payslip_notification'
            if (action === 'send_payslip' || action === 'payslip_notification') {
                const { user_id, title, message } = body;
                if (!user_id || !title || !message) throw new Error('Missing required fields');

                const { error: notifError } = await supabaseAdmin.from('notifications').insert({
                    user_id, title, message, type: 'payslip', unread: true
                });
                if (notifError) throw notifError;

                const { data: tokens, error: tokenError } = await supabaseAdmin.from('user_push_tokens').select('token').eq('user_id', user_id);
                if (tokenError) throw tokenError;

                if (tokens && tokens.length > 0) {
                    const uniqueTokens = [...new Set(tokens.map((t: any) => t.token))] as string[];
                    let friendlyBody = 'Your new payslip is now available.';
                    try {
                        const data = JSON.parse(message);
                        if (data.payPeriod) {
                            friendlyBody = `Your payslip for ${data.payPeriod} is now available.`;
                        }
                    } catch (e) {
                        // Not JSON
                    }

                    const pushPayloads = uniqueTokens.map(token => ({
                        to: token, title, body: friendlyBody, sound: 'default', data: { type: 'payslip', message }
                    }));
                    await sendPushNotifications(pushPayloads);
                }
                return new Response(JSON.stringify({ success: true, message: 'Payslip notification sent' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }
        }

        return new Response(JSON.stringify({ error: 'Method not allowed or Action not found' }), {
            status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
        })
    }
})
