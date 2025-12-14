// fetchTemplateStructure.js
// Run this to see exact structure of your templates: node fetchTemplateStructure.js

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const fetchTemplateStructure = async () => {
  try {
    console.log('🔍 Fetching WhatsApp Template Structures...\n');
    
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
    
    if (!WHATSAPP_API_KEY) {
      console.error('❌ WHATSAPP_API_KEY not found in .env file');
      return;
    }
    
    // First, get the WABA ID
    console.log('Step 1: Getting WABA ID...');
    const userDetailsResponse = await axios.get(
      'https://partnersv1.pinbot.ai/v3/getuserdetails',
      {
        headers: {
          'apikey': WHATSAPP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!userDetailsResponse.data || !userDetailsResponse.data.data || userDetailsResponse.data.data.length === 0) {
      console.error('❌ No WABA accounts found');
      return;
    }
    
    const wabaId = userDetailsResponse.data.data[0].whatsapp_business_account_id;
    console.log('✅ WABA ID:', wabaId);
    console.log('');
    
    // Fetch all templates
    console.log('Step 2: Fetching all templates...\n');
    const templatesResponse = await axios.get(
      `https://partnersv1.pinbot.ai/v3/${wabaId}/message_templates`,
      {
        headers: {
          'apikey': WHATSAPP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!templatesResponse.data || !templatesResponse.data.data) {
      console.error('❌ No templates found');
      return;
    }
    
    console.log('✅ Found templates!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Filter for our specific templates
    const targetTemplates = ['login_otp', 'welcome_patient'];
    
    templatesResponse.data.data.forEach(template => {
      if (targetTemplates.includes(template.name)) {
        console.log(`📋 Template: ${template.name}`);
        console.log(`   ID: ${template.id}`);
        console.log(`   Status: ${template.status}`);
        console.log(`   Category: ${template.category}`);
        console.log(`   Language: ${template.language}`);
        console.log('');
        console.log('   Components:');
        
        if (template.components && template.components.length > 0) {
          template.components.forEach((component, index) => {
            console.log(`   ${index + 1}. Type: ${component.type}`);
            
            if (component.text) {
              console.log(`      Text: ${component.text}`);
            }
            
            if (component.format) {
              console.log(`      Format: ${component.format}`);
            }
            
            if (component.buttons && component.buttons.length > 0) {
              console.log('      Buttons:');
              component.buttons.forEach((button, btnIndex) => {
                console.log(`         ${btnIndex}. Type: ${button.type}`);
                console.log(`            Text: ${button.text}`);
                if (button.url) {
                  console.log(`            URL: ${button.url}`);
                }
                if (button.example) {
                  console.log(`            Example: ${JSON.stringify(button.example)}`);
                }
              });
            }
            
            if (component.example) {
              console.log(`      Example: ${JSON.stringify(component.example)}`);
            }
            
            console.log('');
          });
        }
        
        console.log('   Full JSON Structure:');
        console.log(JSON.stringify(template, null, 2));
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    });
    
    console.log('💡 Use this information to construct the correct payload in your code!');
    
  } catch (error) {
    console.error('❌ Error fetching template structure:');
    console.error('   Message:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
};

// Run the function
fetchTemplateStructure();