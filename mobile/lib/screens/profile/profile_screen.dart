import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _changingPassword = false;
  final _oldPwCtrl = TextEditingController();
  final _newPwCtrl = TextEditingController();
  final _confirmPwCtrl = TextEditingController();
  bool _obscureOld = true, _obscureNew = true, _obscureConfirm = true;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _oldPwCtrl.dispose();
    _newPwCtrl.dispose();
    _confirmPwCtrl.dispose();
    super.dispose();
  }

  Future<void> _changePassword() async {
    setState(() => _error = null);
    if (_newPwCtrl.text != _confirmPwCtrl.text) {
      setState(() => _error = 'New passwords do not match');
      return;
    }
    if (_newPwCtrl.text.length < 8) {
      setState(() => _error = 'Password must be at least 8 characters');
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiService().post('/auth/change-password', {
        'current_password': _oldPwCtrl.text,
        'new_password': _newPwCtrl.text,
      });
      _oldPwCtrl.clear(); _newPwCtrl.clear(); _confirmPwCtrl.clear();
      setState(() { _changingPassword = false; _saving = false; });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed successfully'), backgroundColor: kSuccess));
    } catch (e) {
      setState(() { _error = e.toString().replaceAll('Exception: ', ''); _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      drawer: const AppDrawer(),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar + name
          Center(
            child: Column(children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: kBrand.withOpacity(0.15),
                child: Text(
                  (user?.fullName ?? 'U').isNotEmpty ? user!.fullName[0].toUpperCase() : 'U',
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: kBrand),
                ),
              ),
              const SizedBox(height: 12),
              Text(user?.fullName ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(user?.email ?? '', style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                decoration: BoxDecoration(color: kBrand.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                child: Text(
                  (user?.customRole ?? user?.role ?? '').replaceAll('_', ' '),
                  style: const TextStyle(color: kBrand, fontWeight: FontWeight.w600),
                ),
              ),
            ]),
          ),

          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 8),

          // Info rows
          _infoRow(Icons.person_outline, 'Full Name', user?.fullName ?? '—'),
          _infoRow(Icons.email_outlined, 'Email', user?.email ?? '—'),
          _infoRow(Icons.shield_outlined, 'Role', (user?.role ?? '').replaceAll('_', ' ')),
          if (user?.customRole != null)
            _infoRow(Icons.badge_outlined, 'Custom Role', user!.customRole!.replaceAll('_', ' ')),

          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 8),

          // Change password section
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.lock_outline, color: kBrand),
            title: const Text('Change Password', style: TextStyle(fontWeight: FontWeight.w600)),
            trailing: Icon(_changingPassword ? Icons.expand_less : Icons.expand_more),
            onTap: () => setState(() { _changingPassword = !_changingPassword; _error = null; }),
          ),

          if (_changingPassword) ...[
            const SizedBox(height: 8),
            _pwField('Current Password', _oldPwCtrl, _obscureOld, () => setState(() => _obscureOld = !_obscureOld)),
            const SizedBox(height: 12),
            _pwField('New Password', _newPwCtrl, _obscureNew, () => setState(() => _obscureNew = !_obscureNew)),
            const SizedBox(height: 12),
            _pwField('Confirm New Password', _confirmPwCtrl, _obscureConfirm, () => setState(() => _obscureConfirm = !_obscureConfirm)),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: kDanger.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
                child: Text(_error!, style: const TextStyle(color: kDanger, fontSize: 13)),
              ),
            ],
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: ElevatedButton(
                onPressed: _saving ? null : _changePassword,
                child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Update Password'),
              )),
              const SizedBox(width: 12),
              Expanded(child: OutlinedButton(
                onPressed: () => setState(() { _changingPassword = false; _error = null; }),
                child: const Text('Cancel'),
              )),
            ]),
          ],

          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 8),

          // Sign out
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.logout, color: kDanger),
            title: const Text('Sign Out', style: TextStyle(color: kDanger, fontWeight: FontWeight.w600)),
            onTap: () async {
              await auth.logout();
              if (context.mounted) {
                Navigator.of(context).popUntil((_) => false);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(children: [
      Icon(icon, size: 20, color: Colors.grey),
      const SizedBox(width: 12),
      Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
      const Spacer(),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
    ]),
  );

  Widget _pwField(String label, TextEditingController ctrl, bool obscure, VoidCallback toggle) =>
    TextField(
      controller: ctrl,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: IconButton(icon: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined), onPressed: toggle),
      ),
    );
}
