import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});
  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  List<AppUser> _users = [];
  List<RoleConfig> _roles = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService().get('/users') as Future,
        ApiService().get('/roles') as Future,
      ]);
      if (mounted) setState(() {
        _users = (results[0] as List).map((e) => AppUser.fromJson(e)).toList();
        _roles = (results[1] as List).map((e) => RoleConfig.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  String _roleLabel(AppUser u) {
    final key = u.effectiveRole;
    return _roles.firstWhere((r) => r.name == key, orElse: () => RoleConfig(name: key, displayName: key.replaceAll('_', ' '), isSystem: false, modules: [])).displayName;
  }

  Color _roleColor(String role) {
    switch (role) {
      case 'admin': return Colors.purple.shade100;
      case 'manager': return Colors.blue.shade100;
      case 'auditor': return Colors.orange.shade100;
      default: return Colors.grey.shade100;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton(
        backgroundColor: kBrand,
        child: const Icon(Icons.person_add_outlined, color: Colors.white),
        onPressed: () => _showForm(context),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                itemCount: _users.length,
                itemBuilder: (_, i) {
                  final u = _users[i];
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: kBrand.withOpacity(0.1),
                        child: Text(u.fullName.isNotEmpty ? u.fullName[0].toUpperCase() : 'U',
                            style: const TextStyle(color: kBrand, fontWeight: FontWeight.bold)),
                      ),
                      title: Text(u.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(u.email),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: _roleColor(u.role), borderRadius: BorderRadius.circular(10)),
                            child: Text(_roleLabel(u), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
                          ),
                          if (!u.isActive) const Text('Inactive', style: TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                      onTap: () => _showForm(context, user: u),
                    ),
                  );
                },
              ),
      ),
    );
  }

  void _showForm(BuildContext context, {AppUser? user}) {
    final emailCtrl = TextEditingController(text: user?.email ?? '');
    final nameCtrl = TextEditingController(text: user?.fullName ?? '');
    final passCtrl = TextEditingController();
    String selectedRole = user?.effectiveRole ?? 'team_member';

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(user == null ? 'Add User' : 'Edit User', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name *')),
            const SizedBox(height: 12),
            TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email *')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _roles.any((r) => r.name == selectedRole) ? selectedRole : _roles.firstOrNull?.name,
              decoration: const InputDecoration(labelText: 'Role'),
              items: _roles.map((r) => DropdownMenuItem(value: r.name, child: Text(r.displayName))).toList(),
              onChanged: (v) => setSheet(() => selectedRole = v!),
            ),
            const SizedBox(height: 12),
            TextField(controller: passCtrl, obscureText: true,
              decoration: InputDecoration(labelText: user == null ? 'Password *' : 'New Password (leave blank to keep)')),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: kBrand),
              onPressed: () async {
                if (emailCtrl.text.isEmpty || nameCtrl.text.isEmpty) return;
                const systemRoles = ['admin', 'manager', 'auditor', 'team_member'];
                final isSystem = systemRoles.contains(selectedRole);
                final payload = {
                  'email': emailCtrl.text, 'full_name': nameCtrl.text,
                  'role': isSystem ? selectedRole : 'team_member',
                  'custom_role': isSystem ? '' : selectedRole,
                  if (passCtrl.text.isNotEmpty) 'password': passCtrl.text,
                  if (user == null && passCtrl.text.isEmpty) 'password': 'Temp1234!',
                };
                try {
                  if (user == null) {
                    await ApiService().post('/users', payload);
                  } else {
                    await ApiService().put('/users/${user.id}', payload);
                  }
                  Navigator.pop(ctx);
                  _load();
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(user == null ? 'User created' : 'User updated'), backgroundColor: kSuccess));
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
                }
              },
              child: Text(user == null ? 'Create User' : 'Save Changes', style: const TextStyle(color: Colors.white)),
            )),
          ]),
        ),
      ),
    );
  }
}
