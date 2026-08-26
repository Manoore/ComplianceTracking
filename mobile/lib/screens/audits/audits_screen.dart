import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class AuditsScreen extends StatefulWidget {
  const AuditsScreen({super.key});
  @override
  State<AuditsScreen> createState() => _AuditsScreenState();
}

class _AuditsScreenState extends State<AuditsScreen> {
  List<Audit> _audits = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/audits') as List;
      if (mounted) setState(() { _audits = data.map((e) => Audit.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Audits')),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _audits.isEmpty
                ? const Center(child: Text('No audits yet', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _audits.length,
                    itemBuilder: (_, i) {
                      final audit = _audits[i];
                      return Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          leading: CircleAvatar(
                            backgroundColor: kBrand.withOpacity(0.1),
                            child: const Icon(Icons.shield_outlined, color: kBrand),
                          ),
                          title: Text(audit.clinicName, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(audit.auditorName, style: const TextStyle(fontSize: 12)),
                              const SizedBox(height: 4),
                              Row(children: [
                                statusBadge(audit.status),
                                if (audit.riskLevel != null) ...[const SizedBox(width: 6), statusBadge(audit.riskLevel)],
                                if (audit.overallScore != null) ...[const SizedBox(width: 6), Text('${audit.overallScore!.toStringAsFixed(1)}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))],
                              ]),
                            ],
                          ),
                          trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                          onTap: () async { await context.push('/audits/${audit.id}'); _load(); },
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
