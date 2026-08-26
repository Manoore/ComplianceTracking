import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/reports/dashboard');
      if (mounted) setState(() { _data = data; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _data == null
                ? const Center(child: Text('Could not load reports', style: TextStyle(color: Colors.grey)))
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _sectionTitle('Overview'),
                      _statRow('Total Clinics', '${_data!['total_clinics'] ?? 0}', Icons.local_hospital_outlined, kBrand),
                      _statRow('Total Inspections', '${_data!['total_inspections'] ?? 0}', Icons.search_outlined, Colors.indigo),
                      _statRow('Completed Inspections', '${_data!['completed_inspections'] ?? 0}', Icons.check_circle_outline, kSuccess),
                      _statRow('Avg Compliance Score', '${((_data!['avg_compliance_score'] ?? 0) as num).toStringAsFixed(1)}%', Icons.bar_chart_outlined, kSuccess),
                      _statRow('Open Corrective Actions', '${_data!['open_corrective_actions'] ?? 0}', Icons.warning_amber_outlined, kWarning),
                      _statRow('Overdue Actions', '${_data!['overdue_corrective_actions'] ?? 0}', Icons.error_outline, kDanger),
                      const SizedBox(height: 16),
                      _sectionTitle('Risk Breakdown'),
                      if (_data!['risk_breakdown'] != null)
                        ...(_data!['risk_breakdown'] as Map<String, dynamic>).entries.map((e) =>
                          _statRow(e.key.toUpperCase(), '${e.value} clinics',
                            Icons.circle, e.key == 'high' ? kDanger : e.key == 'medium' ? kWarning : kSuccess)),
                      const SizedBox(height: 16),
                      _sectionTitle('Certifications'),
                      _statRow('Total Certifications', '${_data!['total_certifications'] ?? 0}', Icons.workspace_premium_outlined, Colors.purple),
                      _statRow('Passed', '${_data!['passed_certifications'] ?? 0}', Icons.check_circle_outline, kSuccess),
                    ],
                  ),
      ),
    );
  }

  Widget _sectionTitle(String title) => Padding(
    padding: const EdgeInsets.only(bottom: 8, top: 8),
    child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
  );

  Widget _statRow(String label, String value, IconData icon, Color color) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    child: ListTile(
      leading: CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Icon(icon, color: color, size: 20)),
      title: Text(label),
      trailing: Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 16)),
    ),
  );
}
