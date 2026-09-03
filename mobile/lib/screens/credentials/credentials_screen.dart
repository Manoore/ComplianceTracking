import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class CredentialsScreen extends StatefulWidget {
  const CredentialsScreen({super.key});
  @override
  State<CredentialsScreen> createState() => _CredentialsScreenState();
}

class _CredentialsScreenState extends State<CredentialsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  List<Map<String, dynamic>> _credentials = [];
  List<Map<String, dynamic>> _users = [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService().get('/credentials/') as Future<dynamic>,
        ApiService().get('/users').catchError((_) => <dynamic>[]) as Future<dynamic>,
      ]);
      final creds = (results[0] as List).cast<Map<String, dynamic>>();
      final users = (results[1] as List).cast<Map<String, dynamic>>();
      if (mounted) setState(() { _credentials = creds; _users = users; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'all') return _credentials;
    if (_filter == 'expired') return _credentials.where((c) => _status(c) == 'expired').toList();
    if (_filter == 'expiring') return _credentials.where((c) => _status(c) == 'expiring').toList();
    if (_filter == 'valid') return _credentials.where((c) => _status(c) == 'valid').toList();
    return _credentials;
  }

  String _status(Map<String, dynamic> c) {
    final exp = c['expiry_date'] as String?;
    if (exp == null) return 'valid';
    final expiry = DateTime.tryParse(exp);
    if (expiry == null) return 'valid';
    final now = DateTime.now();
    if (expiry.isBefore(now)) return 'expired';
    if (expiry.isBefore(now.add(const Duration(days: 30)))) return 'expiring';
    return 'valid';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'expired': return kDanger;
      case 'expiring': return kWarning;
      default: return kSuccess;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'expired': return 'Expired';
      case 'expiring': return 'Expiring Soon';
      default: return 'Valid';
    }
  }

  int _daysUntil(String? dateStr) {
    if (dateStr == null) return 9999;
    final d = DateTime.tryParse(dateStr);
    if (d == null) return 9999;
    return d.difference(DateTime.now()).inDays;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final canManage = auth.user?.canManage ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Credentials'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          tabs: const [Tab(text: 'Credentials'), Tab(text: 'Summary')],
        ),
      ),
      drawer: const AppDrawer(),
      floatingActionButton: canManage ? FloatingActionButton(
        backgroundColor: kBrand,
        child: const Icon(Icons.add, color: Colors.white),
        onPressed: () => _showAdd(context),
      ) : null,
      body: TabBarView(
        controller: _tabs,
        children: [
          _credentialsTab(canManage),
          _summaryTab(),
        ],
      ),
    );
  }

  Widget _credentialsTab(bool canManage) {
    return Column(
      children: [
        Container(
          color: Colors.grey.shade50,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: ['all', 'expired', 'expiring', 'valid'].map((f) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(f[0].toUpperCase() + f.substring(1)),
                  selected: _filter == f,
                  selectedColor: f == 'expired' ? kDanger : f == 'expiring' ? kWarning : kBrand,
                  labelStyle: TextStyle(color: _filter == f ? Colors.white : null),
                  onSelected: (_) => setState(() => _filter = f),
                ),
              )).toList(),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? const Center(child: Text('No credentials', style: TextStyle(color: Colors.grey)))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _filtered.length,
                        itemBuilder: (_, i) {
                          final c = _filtered[i];
                          final status = _status(c);
                          final color = _statusColor(status);
                          final days = _daysUntil(c['expiry_date'] as String?);
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                                    child: Icon(Icons.badge_outlined, color: color, size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(c['credential_type'] ?? c['name'] ?? 'Credential',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                    if (c['holder_name'] != null || c['user_name'] != null)
                                      Text(c['holder_name'] ?? c['user_name'] ?? '',
                                        style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                  ])),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
                                    child: Text(_statusLabel(status), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
                                  ),
                                ]),
                                const SizedBox(height: 10),
                                Row(children: [
                                  if (c['expiry_date'] != null) ...[
                                    Icon(Icons.event_outlined, size: 14, color: color),
                                    const SizedBox(width: 4),
                                    Text(
                                      status == 'expired'
                                          ? 'Expired ${c['expiry_date'].toString().substring(0, 10)}'
                                          : status == 'expiring'
                                              ? 'Expires in $days days'
                                              : 'Expires ${c['expiry_date'].toString().substring(0, 10)}',
                                      style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                  const Spacer(),
                                  if (c['license_number'] != null)
                                    Text('#${c['license_number']}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                ]),
                                if (c['notes'] != null) ...[
                                  const SizedBox(height: 6),
                                  Text(c['notes'], style: const TextStyle(fontSize: 12, color: Colors.grey), maxLines: 2, overflow: TextOverflow.ellipsis),
                                ],
                                if (canManage) ...[
                                  const SizedBox(height: 10),
                                  Row(children: [
                                    OutlinedButton.icon(
                                      icon: const Icon(Icons.edit_outlined, size: 14),
                                      label: const Text('Edit'),
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                      onPressed: () => _showEdit(context, c),
                                    ),
                                    const SizedBox(width: 8),
                                    OutlinedButton.icon(
                                      icon: const Icon(Icons.delete_outline, size: 14, color: kDanger),
                                      label: const Text('Delete', style: TextStyle(color: kDanger)),
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(color: kDanger),
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                      onPressed: () => _delete(c['id'] as int, context),
                                    ),
                                  ]),
                                ],
                              ]),
                            ),
                          );
                        },
                      ),
          ),
        ),
      ],
    );
  }

  Widget _summaryTab() {
    final expired = _credentials.where((c) => _status(c) == 'expired').length;
    final expiring = _credentials.where((c) => _status(c) == 'expiring').length;
    final valid = _credentials.where((c) => _status(c) == 'valid').length;
    final total = _credentials.length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _summaryCard('Total Credentials', '$total', Icons.badge_outlined, kBrand),
          _summaryCard('Valid', '$valid', Icons.check_circle_outline, kSuccess),
          _summaryCard('Expiring Soon (30d)', '$expiring', Icons.schedule_outlined, kWarning),
          _summaryCard('Expired', '$expired', Icons.error_outline, kDanger),
          if (expired > 0 || expiring > 0) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: kDanger.withOpacity(0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kDanger.withOpacity(0.2)),
              ),
              child: Row(children: [
                const Icon(Icons.warning_amber_outlined, color: kDanger),
                const SizedBox(width: 10),
                Expanded(child: Text(
                  expired > 0
                      ? '$expired credential${expired != 1 ? 's' : ''} expired. Immediate renewal required.'
                      : '$expiring credential${expiring != 1 ? 's' : ''} expiring within 30 days.',
                  style: const TextStyle(color: kDanger, fontWeight: FontWeight.w500, fontSize: 13),
                )),
              ]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryCard(String label, String value, IconData icon, Color color) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      leading: CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Icon(icon, color: color, size: 20)),
      title: Text(label),
      trailing: Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 18)),
    ),
  );

  void _showAdd(BuildContext context) => _showForm(context, null);
  void _showEdit(BuildContext context, Map<String, dynamic> c) => _showForm(context, c);

  void _showForm(BuildContext context, Map<String, dynamic>? existing) {
    final typeCtrl = TextEditingController(text: existing?['credential_type'] ?? existing?['name'] ?? '');
    final licenseCtrl = TextEditingController(text: existing?['license_number'] ?? '');
    final expiryCtrl = TextEditingController(text: existing?['expiry_date']?.toString().substring(0, 10) ?? '');
    final notesCtrl = TextEditingController(text: existing?['notes'] ?? '');
    String? selectedUserId = existing?['user_id']?.toString();

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setModalState) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(existing == null ? 'Add Credential' : 'Edit Credential',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 16),
            TextField(controller: typeCtrl, decoration: const InputDecoration(labelText: 'Credential Type *', hintText: 'e.g. RN License, DEA Registration')),
            const SizedBox(height: 12),
            if (_users.isNotEmpty) ...[
              DropdownButtonFormField<String>(
                value: selectedUserId,
                decoration: const InputDecoration(labelText: 'Staff Member'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('— Select staff —')),
                  ..._users.map((u) => DropdownMenuItem(value: u['id'].toString(), child: Text(u['full_name'] ?? ''))),
                ],
                onChanged: (v) => setModalState(() => selectedUserId = v),
              ),
              const SizedBox(height: 12),
            ],
            TextField(controller: licenseCtrl, decoration: const InputDecoration(labelText: 'License / ID Number')),
            const SizedBox(height: 12),
            TextField(
              controller: expiryCtrl,
              decoration: const InputDecoration(labelText: 'Expiry Date', hintText: 'YYYY-MM-DD', suffixIcon: Icon(Icons.calendar_today_outlined)),
              keyboardType: TextInputType.datetime,
              onTap: () async {
                final picked = await showDatePicker(
                  context: ctx,
                  initialDate: DateTime.tryParse(expiryCtrl.text) ?? DateTime.now().add(const Duration(days: 365)),
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2040),
                );
                if (picked != null) expiryCtrl.text = picked.toIso8601String().substring(0, 10);
              },
              readOnly: true,
            ),
            const SizedBox(height: 12),
            TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notes'), maxLines: 2),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: () async {
                if (typeCtrl.text.isEmpty) return;
                try {
                  final body = {
                    'credential_type': typeCtrl.text,
                    if (licenseCtrl.text.isNotEmpty) 'license_number': licenseCtrl.text,
                    if (expiryCtrl.text.isNotEmpty) 'expiry_date': expiryCtrl.text,
                    if (notesCtrl.text.isNotEmpty) 'notes': notesCtrl.text,
                    if (selectedUserId != null) 'user_id': int.tryParse(selectedUserId!),
                  };
                  if (existing == null) {
                    await ApiService().post('/credentials/', body);
                  } else {
                    await ApiService().put('/credentials/${existing['id']}', body);
                  }
                  Navigator.pop(ctx);
                  _load();
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(existing == null ? 'Credential added' : 'Credential updated'), backgroundColor: kSuccess));
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
                }
              },
              child: Text(existing == null ? 'Add Credential' : 'Save Changes'),
            )),
          ]),
        ),
      )),
    );
  }

  Future<void> _delete(int id, BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Credential'),
        content: const Text('Are you sure you want to delete this credential?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: kDanger))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService().delete('/credentials/$id');
      _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deleted'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }
}
