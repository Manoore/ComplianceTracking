import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/app_drawer.dart';

class InspectionsScreen extends StatefulWidget {
  const InspectionsScreen({super.key});

  @override
  State<InspectionsScreen> createState() => _InspectionsScreenState();
}

class _InspectionsScreenState extends State<InspectionsScreen> {
  List<Inspection> _inspections = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/inspections') as List;
      if (mounted) setState(() { _inspections = data.map((e) => Inspection.fromJson(e)).toList(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(Inspection insp) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Inspection?'),
        content: Text('Delete this inspection at ${insp.clinicName}? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: kDanger))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService().delete('/inspections/${insp.id}');
      _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Inspection deleted'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    return Scaffold(
      appBar: AppBar(title: const Text('Inspections')),
      drawer: const AppDrawer(),
      bottomNavigationBar: const AppBottomNav(),
      floatingActionButton: user?.canManage == true
          ? FloatingActionButton.extended(
              backgroundColor: kBrand,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('New', style: TextStyle(color: Colors.white)),
              onPressed: () async { await context.push('/inspections/new'); _load(); },
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _inspections.isEmpty
                ? const Center(child: Text('No inspections yet', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _inspections.length,
                    itemBuilder: (_, i) {
                      final insp = _inspections[i];
                      return Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          leading: insp.complianceScore != null
                              ? _ScoreCircle(insp.complianceScore!)
                              : const CircleAvatar(backgroundColor: Colors.grey, child: Icon(Icons.search, color: Colors.white, size: 18)),
                          title: Text(insp.clinicName, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(insp.inspectorName, style: const TextStyle(fontSize: 12)),
                              const SizedBox(height: 4),
                              Row(children: [
                                statusBadge(insp.status),
                                if (insp.riskLevel != null) ...[const SizedBox(width: 6), statusBadge(insp.riskLevel)],
                              ]),
                            ],
                          ),
                          trailing: Column(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (insp.status == 'in_progress' || insp.status == 'draft')
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: kDanger, size: 20),
                                  tooltip: 'Delete inspection',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  visualDensity: VisualDensity.compact,
                                  onPressed: () => _delete(insp),
                                )
                              else
                                const Icon(Icons.chevron_right, color: Colors.grey),
                              const SizedBox(height: 4),
                              Text(
                                insp.submittedAt != null
                                    ? _fmtDate(insp.submittedAt!)
                                    : _fmtDate(insp.createdAt ?? ''),
                                style: const TextStyle(fontSize: 10, color: Colors.grey),
                              ),
                            ],
                          ),
                          onTap: () async { await context.push('/inspections/${insp.id}'); _load(); },
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  String _fmtDate(String iso) {
    try { final d = DateTime.parse(iso); return '${d.day}/${d.month}/${d.year}'; } catch (_) { return ''; }
  }
}

class _ScoreCircle extends StatelessWidget {
  final double score;
  const _ScoreCircle(this.score);
  @override
  Widget build(BuildContext context) {
    final color = score >= 80 ? kSuccess : score >= 60 ? kWarning : kDanger;
    return CircleAvatar(
      backgroundColor: color.withValues(alpha: 0.15),
      child: Text('${score.toInt()}', style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13)),
    );
  }
}
