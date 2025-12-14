// whatsappDebugger.js
// Run this to test WhatsApp welcome message: node whatsappDebugger.js

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const testWhatsAppWelcome = async () => {
  try {
    console.log('🧪 Testing WhatsApp Welcome Patient Template\n');
    
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const TEST_PHONE = process.env.TEST_PHONE || '919876543210'; // Change this to your test number
    
    if (!WHATSAPP_API_KEY || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error('❌ Missing required environment variables:');
      console.error('   - WHATSAPP_API_KEY:', WHATSAPP_API_KEY ? '✅' : '❌');
      console.error('   - WHATSAPP_PHONE_NUMBER_ID:', WHATSAPP_PHONE_NUMBER_ID ? '✅' : '❌');
      return;
    }
    
    console.log('📋 Configuration:');
    console.log('   API Key:', WHATSAPP_API_KEY.substring(0, 20) + '...');
    console.log('   Phone Number ID:', WHATSAPP_PHONE_NUMBER_ID);
    console.log('   Test Phone:', TEST_PHONE);
    console.log('\n');
    
    // Format phone number
    let formattedPhone = TEST_PHONE.toString().replace(/\D/g, '');
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }
    
    console.log('📱 Formatted phone:', formattedPhone);
    console.log('\n');
    
    // Test 1: Get template details
    console.log('📝 Step 1: Fetching template details...');
    try {
      const templateResponse = await axios.get(
        `https://partnersv1.pinbot.ai/v3/getuserdetails`,
        {
          headers: {
            'apikey': WHATSAPP_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Account details fetched');
      console.log('   WABA ID:', templateResponse.data.data[0]?.whatsapp_business_account_id);
    } catch (err) {
      console.error('❌ Failed to fetch template:', err.message);
    }
    
    console.log('\n');
    
    // Test 2: Send welcome_patient template (WITH button parameter)
    console.log('📤 Step 2: Sending welcome_patient template...');
    console.log('\n');
    
    const url = `https://partnersv1.pinbot.ai/v3/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "template",
      template: {
        name: "welcome_patient",
        language: {
          code: "en"
        },
        components: [
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: "get-started"  // ✅ Dynamic URL suffix parameter
              }
            ]
          }
        ]
      }
    };
    
    console.log('🔍 Request Details:');
    console.log('   URL:', url);
    console.log('   Payload:', JSON.stringify(payload, null, 2));
    console.log('\n');
    
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "apikey": WHATSAPP_API_KEY,
      },
      timeout: 15000
    });
    
    console.log('✅ WhatsApp API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n');
    
    if (response.data && response.data.messages && response.data.messages.length > 0) {
      console.log('🎉 SUCCESS! Welcome message sent successfully!');
      console.log('   Message ID:', response.data.messages[0].id);
      console.log('   Sent to:', response.data.contacts[0].wa_id);
      console.log('\n');
      console.log('✅ Integration is working correctly!');
    } else {
      console.log('⚠️ Message sent but status uncertain');
    }
    
  } catch (error) {
    console.error('\n❌ Test Failed:');
    console.error('   Error:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      
      // Provide specific error guidance
      if (error.response.status === 401) {
        console.error('\n💡 Fix: Check your WHATSAPP_API_KEY is correct');
      } else if (error.response.status === 404) {
        console.error('\n💡 Fix: Check your WHATSAPP_PHONE_NUMBER_ID is correct');
      } else if (error.response.data?.error?.message?.includes('template')) {
        console.error('\n💡 Fix: Template may need different parameters or is not approved');
        console.error('   Try checking template status in Pinbot dashboard');
      }
    }
    
    console.log('\n');
    console.log('🔧 Troubleshooting Steps:');
    console.log('   1. Verify template "welcome_patient" is APPROVED in Pinbot');
    console.log('   2. Check template category is "Utility" or "Marketing"');
    console.log('   3. Ensure phone number is registered with WhatsApp Business');
    console.log('   4. Test with a different phone number');
    console.log('   5. Check Pinbot dashboard for any account issues');
  }
};

// Run the test
testWhatsAppWelcome();