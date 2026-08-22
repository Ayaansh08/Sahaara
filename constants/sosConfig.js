/**
 * SOS Config
 * ----------
 * Fill in your emergency contact numbers here.
 * These are used for the SOS alert system.
 */

export const SOS_CONFIG = {
  // Primary emergency contact (caretaker / family member)
  // WhatsApp integration can be added here later
  emergencyContacts: [
    { name: 'Dr. Meera Sharma', phone: '+919876500000', relation: 'Caretaker' },
    { name: 'Rohan',            phone: '+918765432109', relation: 'Son' },
  ],

  // Alert message template (sent to caretaker portal)
  alertMessage: 'SOS Emergency Alert — Senior needs immediate assistance!',

  // How long to wait before auto-dismissing success screen (ms)
  successDismissDelay: 5000,
};
