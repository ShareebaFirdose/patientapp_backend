// whatsappSetupHelper.js
// Run this script once to get your phone_number_id: node whatsappSetupHelper.js

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const getWhatsAppSetupInfo = async () => {
  try {
    console.log('🔍 Fetching WhatsApp Account Details...\n');
    
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
    const WHATSAPP_BUSINESS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER;
    
    if (!WHATSAPP_API_KEY) {
      console.error('❌ WHATSAPP_API_KEY not found in .env file');
      return;
    }
    
    console.log('📋 Configuration:');
    console.log('   API Key:', WHATSAPP_API_KEY);
    console.log('   Business Number:', WHATSAPP_BUSINESS_NUMBER);
    console.log('\n');
    
    // Fetch user details from Pinbot
    const response = await axios.get(
      'https://partnersv1.pinbot.ai/v3/getuserdetails',
      {
        headers: {
          'apikey': WHATSAPP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Successfully fetched account details!\n');
    console.log('📱 Your WhatsApp Business Accounts:\n');
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      response.data.data.forEach((account, index) => {
        console.log(`Account #${index + 1}:`);
        console.log(`   WABA ID: ${account.whatsapp_business_account_id}`);
        console.log(`   Phone Number: ${account.wanumber}`);
        console.log(`   Phone Number ID: ${account.phone_number_id}`);
        console.log('');
      });
      
      // Try to find matching business number
      console.log('🔍 Searching for your business number:', WHATSAPP_BUSINESS_NUMBER);
      console.log('');
      
      const matchingAccount = response.data.data.find(item => {
        const wanumber = item.wanumber || '';
        const cleanWanumber = wanumber.replace(/\D/g, '');
        const cleanBusinessNumber = WHATSAPP_BUSINESS_NUMBER.replace(/\D/g, '');
        
        return (
          wanumber === WHATSAPP_BUSINESS_NUMBER ||
          wanumber === `+${WHATSAPP_BUSINESS_NUMBER}` ||
          wanumber === `91${WHATSAPP_BUSINESS_NUMBER}` ||
          wanumber === `+91${WHATSAPP_BUSINESS_NUMBER}` ||
          cleanWanumber === cleanBusinessNumber ||
          cleanWanumber.endsWith(cleanBusinessNumber)
        );
      });
      
      if (matchingAccount) {
        console.log('✅ FOUND YOUR BUSINESS NUMBER!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 Add this to your .env file:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log(`WHATSAPP_PHONE_NUMBER_ID=${matchingAccount.phone_number_id}`);
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('✅ After adding this, restart your server for WhatsApp to work!');
      } else {
        console.log('❌ Could not find matching business number.');
        console.log('⚠️  Please check your WHATSAPP_BUSINESS_NUMBER in .env');
        console.log('');
        console.log('Available numbers:');
        response.data.data.forEach(item => {
          console.log(`   - ${item.wanumber} (ID: ${item.phone_number_id})`);
        });
        console.log('');
        console.log('💡 Tip: Copy one of the phone_number_id values above and add to .env:');
        console.log('   WHATSAPP_PHONE_NUMBER_ID=<paste_id_here>');
      }
    } else {
      console.log('❌ No WhatsApp accounts found for this API key');
    }
    
  } catch (error) {
    console.error('❌ Error fetching WhatsApp details:');
    console.error('   Message:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   1. Check your WHATSAPP_API_KEY in .env');
    console.log('   2. Make sure you have access to Pinbot dashboard');
    console.log('   3. Verify your API key has proper permissions');
  }
};

// Run the function
getWhatsAppSetupInfo();