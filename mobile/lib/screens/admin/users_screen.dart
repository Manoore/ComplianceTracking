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
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/users') as List;
      if (mounted) setState(() { _users = data.map((e) => AppUser.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton(
        backgroundColor: kBrand,
        child: const Icon(Icons.person_add_outlined, color: Colors.white),
        onPressed: () => _showInvite(context),
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
                          statusBadge(u.role.replaceAll('_', ' ')),
                          if (!u.isActive) const Text('Inactive', style: TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }

  void _showInvite(BuildContext context) {
    final emailCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    String role = 'team_member';
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Invite User', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name *')),
            const SizedBox(height: 12),
            TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email *')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: role,
              decoration: const InputDecoration(labelText: 'Role'),
              items: ['admin', 'manager', 'auditor', 'team_member'].map((r) => DropdownMenuItem(value: r, child: Text(r.replaceAll('_', ' ')))).toList(),
              onChanged: (v) => setSheet(() => role = v!),
            ),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: () async {
                if (emailCtrl.text.isEmpty || nameCtrl.text.isEmpty) return;
                try {
                  await ApiService().post('/users', {'email': emailCtrl.text, 'full_name': nameCtrl.text, 'role': role, 'password': 'Temp1234!'});
                  Navigator.pop(ctx);
                  _load();
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('User created'), backgroundColor: kSuccess));
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
                }
              },
              child: const Text('Create User'),
            )),
          ]),
        ),
      ),
    );
  }
}
