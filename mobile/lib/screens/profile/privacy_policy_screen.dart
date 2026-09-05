import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy Policy')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('CompliNow Privacy Policy', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Last updated: 2025-01-01', style: TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 20),
          _section('1. Information We Collect',
            'CompliNow collects information necessary to provide compliance management services to healthcare organizations:\n\n'
            '• Account information: name, email address, role within your organization\n'
            '• Inspection data: checklist responses, photos, GPS coordinates of inspection sites\n'
            '• Credential data: professional license numbers and expiry dates\n'
            '• Usage data: app interactions and session timestamps for audit trail purposes'),
          _section('2. How We Use Your Information',
            'We use collected information to:\n\n'
            '• Provide compliance tracking and reporting services\n'
            '• Generate inspection reports and corrective action workflows\n'
            '• Send compliance alerts and policy acknowledgment reminders\n'
            '• Maintain audit logs as required by applicable regulations'),
          _section('3. HIPAA Compliance',
            'CompliNow is designed to support HIPAA compliance workflows. We do not store Protected Health Information (PHI) within the app. '
            'Inspection data and compliance records are stored securely and transmitted over encrypted connections (TLS 1.2+).\n\n'
            'If your organization uses CompliNow as part of a HIPAA-covered program, please contact us to execute a Business Associate Agreement (BAA).'),
          _section('4. Data Security',
            'We implement industry-standard security measures:\n\n'
            '• All data transmitted over HTTPS/TLS encryption\n'
            '• Authentication tokens stored in device secure storage (iOS Keychain / Android Keystore)\n'
            '• No cleartext storage of credentials\n'
            '• Automatic session expiry after inactivity\n'
            '• Cloud backup excluded for sensitive data'),
          _section('5. Data Sharing',
            'We do not sell your personal information. Data is shared only:\n\n'
            '• Within your organization (role-based access control)\n'
            '• With service providers necessary to operate the platform (hosting, email delivery)\n'
            '• When required by law or regulatory authorities'),
          _section('6. Camera & Location',
            'Camera access is used exclusively to capture inspection evidence photos. '
            'Location access is used to record GPS coordinates of inspection sites. '
            'Neither camera images nor location data are shared outside your organization without your consent.'),
          _section('7. Data Retention',
            'Inspection records and compliance data are retained for the period required by your organization\'s policies and applicable regulations. '
            'You may request deletion of your account data by contacting your organization administrator or our support team.'),
          _section('8. Your Rights',
            'Depending on your jurisdiction, you may have rights to:\n\n'
            '• Access the personal data we hold about you\n'
            '• Request correction of inaccurate data\n'
            '• Request deletion of your data\n'
            '• Object to certain processing\n\n'
            'To exercise these rights, contact support@complinow.com'),
          _section('9. Contact Us',
            'For privacy questions or to report a concern:\n\n'
            'Email: privacy@complinow.com\n'
            'Support: support@complinow.com'),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            icon: const Icon(Icons.open_in_new, size: 16),
            label: const Text('View Full Policy Online'),
            onPressed: () => launchUrl(Uri.parse('https://complinow.com/privacy'), mode: LaunchMode.externalApplication),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _section(String title, String body) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      const SizedBox(height: 6),
      Text(body, style: const TextStyle(fontSize: 14, height: 1.6, color: Color(0xFF444444))),
    ]),
  );
}
