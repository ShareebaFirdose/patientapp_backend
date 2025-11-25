// utils/whatsappProviders.js
import axios from "axios";

/* ============================================================
   📱 WHATSAPP BUSINESS API - TEMPLATE-BASED IMPLEMENTATION
   
   IMPORTANT: Meta's WhatsApp Business API requires PRE-APPROVED
   templates for business-initiated messages!
============================================================ */

/* ============================================================
   STEP 1: CREATE TEMPLATES IN PINBOT DASHBOARD
   
   You need to create these templates in your Pinbot/Meta dashboard:
   
   Template 1: welcome_message
   Category: Utility
   Body: "Welcome {{1}}! Thank you for signing up with PRED CARE. 
          Your account has been successfully verified. You can now 
          book appointments, access video consultations, and manage 
          your health records."
   
   Template 2: appointment_confirmation
   Category: Utility  
   Body: "Hi {{1}}, your appointment is confirmed!
          Appointment ID: {{2}}
          Doctor: Dr. {{3}}
          Date: {{4}}
          Time: {{5}}
          Fee: ₹{{6}}
          Transaction ID: {{7}}"
============================================================ */

export const sendWhatsAppTemplate = async (phone, templateName, parameters) => {
  try {
    const PINBOT_API_URL = process.env.WHATSAPP_API_URL;
    const PINBOT_API_KEY = process.env.WHATSAPP_API_KEY;
    const PINBOT_SENDER = process.env.WHATSAPP_SENDER;

    // Format phone number
    let formattedPhone = phone.replace(/[\s+-]/g, '');
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    console.log('📱 Sending WhatsApp template via Pinbot:', {
      to: formattedPhone,
      template: templateName
    });

    // Try different endpoint formats for template messages
    const endpoints = [
      // Format 1: Standard template endpoint
      {
        url: `${PINBOT_API_URL}/api/v1/template/send`,
        payload: {
          apikey: PINBOT_API_KEY,
          phone: formattedPhone,
          template_name: templateName,
          parameters: parameters
        }
      },
      // Format 2: Messages endpoint
      {
        url: `${PINBOT_API_URL}/messages/template`,
        payload: {
          to: formattedPhone,
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: parameters.map(param => ({ type: "text", text: param }))
              }
            ]
          }
        },
        headers: {
          "Authorization": `Bearer ${PINBOT_API_KEY}`,
          "Content-Type": "application/json"
        }
      },
      // Format 3: WhatsApp Business API standard format
      {
        url: `${PINBOT_API_URL}/v1/messages`,
        payload: {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: parameters.map(param => ({ type: "text", text: param }))
              }
            ]
          }
        },
        headers: {
          "Authorization": `Bearer ${PINBOT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    ];

    // Try each endpoint format
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const endpoint = endpoints[i];
        console.log(`🔄 Trying endpoint format ${i + 1}...`);

        const response = await axios.post(
          endpoint.url,
          endpoint.payload,
          {
            headers: endpoint.headers || {
              "Content-Type": "application/json",
              "apikey": PINBOT_API_KEY
            }
          }
        );

        console.log(`✅ Format ${i + 1} SUCCESS!`);
        console.log('✅ WhatsApp template sent to:', formattedPhone);
        console.log('📥 Response:', response.data);
        return true;

      } catch (error) {
        console.log(`❌ Format ${i + 1} failed:`, error.response?.status, error.response?.data?.error || error.message);
      }
    }

    console.error('❌ All template endpoint formats failed');
    return false;

  } catch (error) {
    console.error('❌ WhatsApp Template Error:', error.message);
    return false;
  }
};

/* ============================================================
   📱 MAIN WHATSAPP NOTIFICATION FUNCTION
============================================================ */
export const sendWhatsAppNotification = async (phone, type, data) => {
  try {
    // Validate phone number
    if (!phone || phone.length < 10) {
      console.log("⚠️ Invalid phone number:", phone);
      return false;
    }

    let templateName = "";
    let parameters = [];

    if (type === "signup_welcome") {
      // Template: welcome_message
      // Body: "Welcome {{1}}! Thank you for signing up with PRED CARE..."
      templateName = "welcome_message";
      parameters = [data.name];
    } 
    else if (type === "appointment_patient") {
      // Template: appointment_confirmation
      // Body: "Hi {{1}}, your appointment is confirmed! ID: {{2}}, Doctor: Dr. {{3}}..."
      templateName = "appointment_confirmation";
      parameters = [
        data.patientName,
        data.appointment_id,
        data.doctor_name,
        data.appointment_date,
        data.appointment_slot_time,
        data.appointment_fee.toString(),
        data.transaction_id
      ];
    } 
    else if (type === "appointment_doctor") {
      // Template: new_appointment_doctor
      templateName = "new_appointment_doctor";
      parameters = [
        data.doctor_name,
        data.patientName,
        data.patientEmail,
        data.patientPhone,
        data.appointment_date,
        data.appointment_slot_time,
        data.appointment_id
      ];
    } 
    else if (type === "otp") {
      // Template: otp_message
      // Body: "Your PRED CARE OTP is: {{1}}. Valid for 10 minutes..."
      templateName = "otp_message";
      parameters = [data.otp];
    }
    else {
      console.log("⚠️ Unknown notification type:", type);
      return false;
    }

    return await sendWhatsAppTemplate(phone, templateName, parameters);

  } catch (error) {
    console.error("❌ WhatsApp Notification Error:", error.message);
    return false;
  }
};

/* ============================================================
   🧪 TEST FUNCTION
============================================================ */
export const testPinbotConnection = async () => {
  console.log("🧪 Testing Pinbot WhatsApp Template Connection...");
  console.log("📋 Config:", {
    url: process.env.WHATSAPP_API_URL,
    sender: process.env.WHATSAPP_SENDER,
    apiKey: process.env.WHATSAPP_API_KEY ? "✅ Set" : "❌ Missing"
  });

  console.log("\n⚠️  IMPORTANT: You must create templates in Pinbot dashboard first!");
  console.log("   Template name: welcome_message");
  console.log("   Parameters: {{1}} for name\n");

  const testPhone = "9876543210"; // Change to your number
  const result = await sendWhatsAppTemplate(testPhone, "welcome_message", ["Test User"]);
  
  if (result) {
    console.log("✅ Pinbot template test PASSED!");
  } else {
    console.log("❌ Pinbot template test FAILED!");
    console.log("💡 Make sure you've created the template in Pinbot dashboard");
  }
  
  return result;
};