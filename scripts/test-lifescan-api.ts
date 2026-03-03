import { fetchLifeScanData, fetchLifeScanProfiles } from '../src/lib/lifescan';
import { isAccountingConfigured } from '../src/lib/accounting-service';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Testing LifeScan Accounting Edge Function API...');
    console.log('URL:', process.env.LIFESCAN_API_URL);
    console.log('Key:', process.env.LIFESCAN_API_KEY ? '******' + process.env.LIFESCAN_API_KEY.slice(-4) : 'MISSING');
    console.log('Configured:', isAccountingConfigured());

    try {
        // Test 1: Fetch DTR records (optionally with date range)
        const startDate = '2024-02-01';
        const endDate = '2024-02-28';
        console.log(`\n1. Fetching DTR records (${startDate} to ${endDate})...`);
        const data = await fetchLifeScanData({ start_date: startDate, end_date: endDate });
        console.log(`   Fetched ${data.length} records.`);

        if (data.length > 0) {
            console.log('   Sample:', JSON.stringify(data[0], null, 2).slice(0, 300) + '...');
        }

        // Test 2: Fetch profiles (get_users_with_dtr)
        console.log('\n2. Fetching employee profiles...');
        const profiles = await fetchLifeScanProfiles();
        console.log(`   Fetched ${profiles.length} unique profiles.`);
        if (profiles.length > 0) {
            console.log('   Sample:', profiles[0].last_name + ', ' + profiles[0].first_name, `(${profiles[0].employee_id})`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
