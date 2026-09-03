import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class ClinicsScreen extends StatefulWidget {
  const ClinicsScreen({super.key});
  @override
  State<ClinicsScreen> createState() => _ClinicsScreenState();
}

class _ClinicsScreenState extends State<ClinicsScreen> {
  List<Clinic> _clinics = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/clinics') as List;
      if (mounted) setState(() { _clinics = data.map((e) => Clinic.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  List<Clinic> get _filtered {
    if (_search.isEmpty) return _clinics;
    final q = _search.toLowerCase();
    return _clinics.where((c) => c.name.toLowerCase().contains(q) || (c.address?.toLowerCase().contains(q) ?? false)).toList();
  }

  Color _scoreColor(double? score) {
    if (score == null) return Colors.grey;
    if (score >= 80) return kSuccess;
    if (score >= 60) return kWarning;
    return kDanger;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final canManage = auth.user?.canManage ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('Clinics')),
      drawer: const AppDrawer(),
      floatingActionButton: canManage ? FloatingActionButton(
        backgroundColor: kBrand,
        child: const Icon(Icons.add, color: Colors.white),
        onPressed: () => _showForm(context, null),
      ) : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search clinics…',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? const Center(child: Text('No clinics found', style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) {
                            final c = _filtered[i];
                            final scoreColor = _scoreColor(c.complianceScore);
                            return Card(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: canManage ? () => _showForm(context, c) : null,
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Row(children: [
                                      CircleAvatar(
                                        backgroundColor: kBrand.withOpacity(0.1),
                                        child: const Icon(Icons.local_hospital_outlined, color: kBrand),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text(c.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                        if (c.address != null) Text(c.address!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                      ])),
                                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                        statusBadge(c.isActive ? 'active' : 'inactive'),
                                        if (c.complianceScore != null) ...[
                                          const SizedBox(height: 4),
                                          Text('${c.complianceScore!.toStringAsFixed(1)}%',
                                            style: TextStyle(fontWeight: FontWeight.bold, color: scoreColor, fontSize: 15)),
                                        ],
                                      ]),
                                    ]),
                                    if (c.complianceScore != null) ...[
                                      const SizedBox(height: 10),
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(4),
                                        child: LinearProgressIndicator(
                                          value: c.complianceScore! / 100,
                                          backgroundColor: Colors.grey.shade200,
                                          color: scoreColor,
                                          minHeight: 6,
                                        ),
                                      ),
                                    ],
                                    if (canManage) ...[
                                      const SizedBox(height: 10),
                                      Row(children: [
                                        OutlinedButton.icon(
                                          icon: const Icon(Icons.edit_outlined, size: 14),
                                          label: const Text('Edit'),
                                          style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6)),
                                          onPressed: () => _showForm(context, c),
                                        ),
                                        const SizedBox(width: 8),
                                        OutlinedButton.icon(
                                          icon: Icon(c.isActive ? Icons.block_outlined : Icons.check_circle_outline, size: 14, color: c.isActive ? kDanger : kSuccess),
                                          label: Text(c.isActive ? 'Deactivate' : 'Activate', style: TextStyle(color: c.isActive ? kDanger : kSuccess)),
                                          style: OutlinedButton.styleFrom(
                                            side: BorderSide(color: c.isActive ? kDanger : kSuccess),
                                            visualDensity: VisualDensity.compact,
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                          ),
                                          onPressed: () => _toggleActive(c),
                                        ),
                                      ]),
                                    ],
                                  ]),
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleActive(Clinic c) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(c.isActive ? 'Deactivate Clinic?' : 'Activate Clinic?'),
        content: Text(c.isActive
            ? 'Deactivating ${c.name} will hide it from active views.'
            : 'Reactivating ${c.name} will make it visible again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true),
            child: Text(c.isActive ? 'Deactivate' : 'Activate',
              style: TextStyle(color: c.isActive ? kDanger : kSuccess))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService().put('/clinics/${c.id}', {'name': c.name, 'is_active': !c.isActive});
      _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(c.isActive ? '${c.name} deactivated' : '${c.name} activated'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }

  void _showForm(BuildContext context, Clinic? existing) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final addressCtrl = TextEditingController(text: existing?.address ?? '');
    final phoneCtrl = TextEditingController(text: existing?.phone ?? '');
    final emailCtrl = TextEditingController(text: existing?.email ?? '');
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setModalState) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(existing == null ? 'Add Clinic' : 'Edit Clinic',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Clinic Name *')),
            const SizedBox(height: 12),
            TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: 'Address')),
            const SizedBox(height: 12),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 12),
            TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: saving ? null : () async {
                if (nameCtrl.text.isEmpty) return;
                setModalState(() => saving = true);
                try {
                  final body = {
                    'name': nameCtrl.text,
                    if (addressCtrl.text.isNotEmpty) 'address': addressCtrl.text,
                    if (phoneCtrl.text.isNotEmpty) 'phone': phoneCtrl.text,
                    if (emailCtrl.text.isNotEmpty) 'email': emailCtrl.text,
                  };
                  if (existing == null) {
                    await ApiService().post('/clinics', body);
                  } else {
                    await ApiService().put('/clinics/${existing.id}', body);
                  }
                  Navigator.pop(ctx);
                  _load();
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(existing == null ? 'Clinic added' : 'Clinic updated'), backgroundColor: kSuccess));
                } catch (e) {
                  setModalState(() => saving = false);
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
                }
              },
              child: saving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(existing == null ? 'Add Clinic' : 'Save Changes'),
            )),
          ]),
        ),
      )),
    );
  }
}
