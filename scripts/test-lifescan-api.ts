import { fetchLifeScanData } from '../src/lib/lifescan';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
    console.log('Testing LifeScan API Integration...');
    console.log('URL:', process.env.LIFESCAN_API_URL);
    // Mask key for security in logs
    console.log('Key:', process.env.LIFESCAN_API_KEY ? '******' + process.env.LIFESCAN_API_KEY.slice(-4) : 'MISSING');

    try {
        const data = await fetchLifeScanData();
        console.log(`Successfully fetched ${data.length} records.`);

        if (data.length > 0) {
            console.log('Sample Record:', JSON.stringify(data[0], null, 2));

            // Check for unique profiles
            const uniqueProfiles = new Map();
            data.forEach(record => {
                if (record.profiles && record.profiles.employee_id) {
                    uniqueProfiles.set(record.profiles.employee_id, record.profiles);
                }
            });

            console.log(`Found ${uniqueProfiles.size} unique employees.`);
            console.log('Employee IDs:', Array.from(uniqueProfiles.keys()).join(', '));
        } else {
            console.log("No data returned from API.");
        }

    } catch (error) {
        console.error('Error testing API:', error);
    }
}

main();
