import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

const _allModules = [
  ('clinics', 'Clinics'),
  ('checklists', 'Checklists'),
  ('inspections', 'Inspections'),
  ('audits', 'Audits'),
  ('certifications', 'Certifications'),
  ('corrective_actions', 'Corrective Actions'),
  ('announcements', 'Announcements'),
  ('reports', 'Reports'),
];

class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key});
  @override
  State<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
  List<RoleConfig> _roles = [];
  bool _loading = true;
  String? _selectedRole;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/roles') as List;
      final roles = data.map((e) => RoleConfig.fromJson(e)).where((r) => r.name != 'admin').toList();
      if (mounted) setState(() { _roles = roles; _selectedRole ??= roles.isNotEmpty ? roles.first.name : null; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _toggleModule(RoleConfig role, String module) async {
    final has = role.modules.contains(module);
    final next = has ? role.modules.where((m) => m != module).toList() : [...role.modules, module];
    try {
      await ApiService().put('/roles/${role.name}/permissions', {'modules': next});
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }

  Future<void> _renameRole(RoleConfig role) async {
    final ctrl = TextEditingController(text: role.displayName);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rename Role'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Display Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (confirmed == true && ctrl.text.trim().isNotEmpty) {
      try {
        await ApiService().patch('/roles/${role.name}', {'display_name': ctrl.text.trim()});
        await _load();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
      }
    }
  }

  Future<void> _deleteRole(RoleConfig role) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Role'),
        content: Text('Delete "${role.displayName}"? Users with this role will lose their custom permissions.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: kDanger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok == true) {
      try {
        await ApiService().delete('/roles/${role.name}');
        setState(() { _selectedRole = null; });
        await _load();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
      }
    }
  }

  Future<void> _createRole() async {
    final ctrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create New Role'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Role Name (e.g. Field Inspector)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (confirmed == true && ctrl.text.trim().isNotEmpty) {
      final display = ctrl.text.trim();
      final name = display.toLowerCase().replaceAll(RegExp(r'\s+'), '_');
      try {
        await ApiService().post('/roles', {'name': name, 'display_name': display});
        setState(() => _selectedRole = name);
        await _load();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _roles.where((r) => r.name == _selectedRole).firstOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('Roles & Permissions')),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: kBrand,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Role', style: TextStyle(color: Colors.white)),
        onPressed: _createRole,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  color: Colors.grey.shade50,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: _roles.map((r) {
                        final active = r.name == _selectedRole;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(r.displayName),
                            selected: active,
                            selectedColor: kBrand,
                            labelStyle: TextStyle(color: active ? Colors.white : null, fontWeight: FontWeight.w500),
                            onSelected: (_) => setState(() => _selectedRole = r.name),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                if (selected != null) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Row(
                      children: [
                        Text(selected.displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(width: 8),
                        if (selected.isSystem) ...[
                          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(10)),
                            child: const Text('System', style: TextStyle(fontSize: 11, color: Colors.blue))),
                        ],
                        const Spacer(),
                        IconButton(icon: const Icon(Icons.edit_outlined, size: 20), tooltip: 'Rename', onPressed: () => _renameRole(selected)),
                        if (!selected.isSystem)
                          IconButton(icon: const Icon(Icons.delete_outline, size: 20, color: Colors.red), tooltip: 'Delete', onPressed: () => _deleteRole(selected)),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView(
                      children: _allModules.map((mod) {
                        final has = selected.modules.contains(mod.$1);
                        return SwitchListTile(
                          title: Text(mod.$2),
                          value: has,
                          activeColor: kBrand,
                          onChanged: (_) => _toggleModule(selected, mod.$1),
                        );
                      }).toList(),
                    ),
                  ),
                ] else
                  const Expanded(child: Center(child: Text('Select a role to manage permissions', style: TextStyle(color: Colors.grey)))),
              ],
            ),
    );
  }
}
