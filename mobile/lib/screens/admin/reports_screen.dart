import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
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
  List<Map<String, dynamic>> _clinics = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService().get('/reports/dashboard') as Future<dynamic>,
        ApiService().get('/clinics').catchError((_) => <dynamic>[]) as Future<dynamic>,
      ]);
      if (mounted) setState(() {
        _data = results[0] as Map<String, dynamic>;
        _clinics = (results[1] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Color _scoreColor(double score) {
    if (score >= 80) return kSuccess;
    if (score >= 60) return kWarning;
    return kDanger;
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

                      const SizedBox(height: 20),
                      _sectionTitle('Compliance by Clinic'),
                      _clinicChart(),

                      const SizedBox(height: 20),
                      _sectionTitle('Risk Breakdown'),
                      if (_data!['risk_breakdown'] != null)
                        ...(_data!['risk_breakdown'] as Map<String, dynamic>).entries.map((e) =>
                          _statRow(e.key.toUpperCase(), '${e.value} clinics',
                            Icons.circle, e.key == 'high' ? kDanger : e.key == 'medium' ? kWarning : kSuccess)),

                      const SizedBox(height: 20),
                      _sectionTitle('Certifications'),
                      _statRow('Total Certifications', '${_data!['total_certifications'] ?? 0}', Icons.workspace_premium_outlined, Colors.purple),
                      _statRow('Passed', '${_data!['passed_certifications'] ?? 0}', Icons.check_circle_outline, kSuccess),
                    ],
                  ),
      ),
    );
  }

  Widget _clinicChart() {
    final withScore = _clinics.where((c) => c['compliance_score'] != null).toList();
    withScore.sort((a, b) => (b['compliance_score'] as num).compareTo(a['compliance_score'] as num));
    final display = withScore.take(6).toList();

    if (display.isEmpty) {
      return Card(child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          const Icon(Icons.bar_chart_outlined, size: 40, color: Colors.grey),
          const SizedBox(height: 8),
          const Text('No clinic score data yet', style: TextStyle(color: Colors.grey)),
        ]),
      ));
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Padding(
            padding: EdgeInsets.only(left: 8, bottom: 12),
            child: Text('Top Clinics by Score', style: TextStyle(fontSize: 13, color: Colors.grey)),
          ),
          SizedBox(
            height: 180,
            child: BarChart(BarChartData(
              alignment: BarChartAlignment.spaceAround,
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipItem: (group, gi, rod, ri) => BarTooltipItem(
                    '${display[group.x]['name']}\n${rod.toY.toStringAsFixed(1)}%',
                    const TextStyle(color: Colors.white, fontSize: 11),
                  ),
                ),
              ),
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(sideTitles: SideTitles(
                  showTitles: true,
                  getTitlesWidget: (v, _) {
                    final name = display[v.toInt()]['name'] as String? ?? '';
                    final short = name.length > 6 ? name.substring(0, 6) : name;
                    return Padding(padding: const EdgeInsets.only(top: 4), child: Text(short, style: const TextStyle(fontSize: 9, color: Colors.grey)));
                  },
                )),
                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                leftTitles: AxisTitles(sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text('${v.toInt()}%', style: const TextStyle(fontSize: 9, color: Colors.grey)),
                )),
              ),
              borderData: FlBorderData(show: false),
              gridData: FlGridData(
                drawHorizontalLine: true,
                horizontalInterval: 25,
                getDrawingHorizontalLine: (_) => FlLine(color: Colors.grey.shade200, strokeWidth: 1),
              ),
              minY: 0, maxY: 100,
              barGroups: List.generate(display.length, (i) {
                final score = (display[i]['compliance_score'] as num).toDouble();
                return BarChartGroupData(x: i, barRods: [
                  BarChartRodData(
                    toY: score,
                    color: _scoreColor(score),
                    width: 18,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                    backDrawRodData: BackgroundBarChartRodData(show: true, toY: 100, color: Colors.grey.shade100),
                  ),
                ]);
              }),
            )),
          ),
        ]),
      ),
    );
  }

  Widget _sectionTitle(String title) => Padding(
    padding: const EdgeInsets.only(bottom: 8, top: 4),
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
