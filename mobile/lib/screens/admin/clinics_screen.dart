import 'package:flutter/material.dart';
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

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/clinics') as List;
      if (mounted) setState(() { _clinics = data.map((e) => Clinic.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Clinics')),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton(
        backgroundColor: kBrand,
        child: const Icon(Icons.add, color: Colors.white),
        onPressed: () => _showAdd(context),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _clinics.isEmpty
                ? const Center(child: Text('No clinics yet', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _clinics.length,
                    itemBuilder: (_, i) {
                      final c = _clinics[i];
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: kBrand.withOpacity(0.1),
                            child: const Icon(Icons.local_hospital_outlined, color: kBrand),
                          ),
                          title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            if (c.address != null) Text(c.address!, style: const TextStyle(fontSize: 12)),
                            if (c.complianceScore != null) Text('Score: ${c.complianceScore!.toStringAsFixed(1)}%', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                          ]),
                          trailing: statusBadge(c.isActive ? 'active' : 'inactive'),
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  void _showAdd(BuildContext context) {
    final nameCtrl = TextEditingController();
    final addressCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Add Clinic', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
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
              onPressed: () async {
                if (nameCtrl.text.isEmpty) return;
                try {
                  await ApiService().post('/clinics', {
                    'name': nameCtrl.text,
                    if (addressCtrl.text.isNotEmpty) 'address': addressCtrl.text,
                    if (phoneCtrl.text.isNotEmpty) 'phone': phoneCtrl.text,
                    if (emailCtrl.text.isNotEmpty) 'email': emailCtrl.text,
                  });
                  Navigator.pop(ctx);
                  _load();
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Clinic added'), backgroundColor: kSuccess));
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
                }
              },
              child: const Text('Add Clinic'),
            )),
          ]),
        ),
      ),
    );
  }
}
