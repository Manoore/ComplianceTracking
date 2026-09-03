import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class ExecutiveDashboardScreen extends StatefulWidget {
  const ExecutiveDashboardScreen({super.key});
  @override
  State<ExecutiveDashboardScreen> createState() => _ExecutiveDashboardScreenState();
}

class _ExecutiveDashboardScreenState extends State<ExecutiveDashboardScreen> {
  Map<String, dynamic>? _dash;
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
        _dash = results[0] as Map<String, dynamic>;
        _clinics = (results[1] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Executive Dashboard')),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _dash == null
                ? const Center(child: Text('Could not load data', style: TextStyle(color: Colors.grey)))
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _kpiRow(),
                      const SizedBox(height: 20),
                      _sectionTitle('Compliance Score by Clinic'),
                      _clinicScoreChart(),
                      const SizedBox(height: 20),
                      _sectionTitle('Risk Distribution'),
                      _riskPieChart(),
                      const SizedBox(height: 20),
                      _sectionTitle('Corrective Actions'),
                      _actionsChart(),
                    ],
                  ),
      ),
    );
  }

  Widget _kpiRow() {
    final d = _dash!;
    final avg = (d['avg_compliance_score'] ?? 0) as num;
    return Row(children: [
      Expanded(child: _kpiCard('Avg Score', '${avg.toStringAsFixed(1)}%', _scoreColor(avg.toDouble()), Icons.bar_chart_outlined)),
      const SizedBox(width: 10),
      Expanded(child: _kpiCard('Clinics', '${d['total_clinics'] ?? 0}', kBrand, Icons.local_hospital_outlined)),
      const SizedBox(width: 10),
      Expanded(child: _kpiCard('Open Actions', '${d['open_corrective_actions'] ?? 0}', kWarning, Icons.warning_amber_outlined)),
    ]);
  }

  Widget _kpiCard(String label, String value, Color color, IconData icon) => Card(
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey), textAlign: TextAlign.center),
      ]),
    ),
  );

  Widget _sectionTitle(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(t, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
  );

  Widget _clinicScoreChart() {
    final clinicsWithScore = _clinics.where((c) => c['compliance_score'] != null).toList();
    clinicsWithScore.sort((a, b) => (a['compliance_score'] as num).compareTo(b['compliance_score'] as num));
    final display = clinicsWithScore.take(8).toList();

    if (display.isEmpty) {
      return const Card(child: Padding(
        padding: EdgeInsets.all(20),
        child: Center(child: Text('No score data available', style: TextStyle(color: Colors.grey))),
      ));
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 16, 12),
        child: SizedBox(
          height: display.length * 44.0,
          child: BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipItem: (group, groupIndex, rod, rodIndex) => BarTooltipItem(
                    '${display[group.x]['name']}\n${rod.toY.toStringAsFixed(1)}%',
                    const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ),
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                leftTitles: AxisTitles(sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text('${v.toInt()}%', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                )),
              ),
              borderData: FlBorderData(show: false),
              gridData: FlGridData(
                drawHorizontalLine: true,
                horizontalInterval: 20,
                getDrawingHorizontalLine: (_) => FlLine(color: Colors.grey.shade200, strokeWidth: 1),
              ),
              minY: 0, maxY: 100,
              barGroups: List.generate(display.length, (i) {
                final score = (display[i]['compliance_score'] as num).toDouble();
                return BarChartGroupData(x: i, barRods: [
                  BarChartRodData(
                    toY: score,
                    color: _scoreColor(score),
                    width: 16,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                  ),
                ]);
              }),
            ),
          ),
        ),
      ),
    );
  }

  Widget _riskPieChart() {
    final breakdown = _dash!['risk_breakdown'] as Map<String, dynamic>?;
    if (breakdown == null || breakdown.isEmpty) {
      return const Card(child: Padding(
        padding: EdgeInsets.all(20),
        child: Center(child: Text('No risk data available', style: TextStyle(color: Colors.grey))),
      ));
    }
    final high = (breakdown['high'] ?? 0) as int;
    final medium = (breakdown['medium'] ?? 0) as int;
    final low = (breakdown['low'] ?? 0) as int;
    final total = high + medium + low;
    if (total == 0) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          SizedBox(
            width: 140,
            height: 140,
            child: PieChart(PieChartData(
              sectionsSpace: 3,
              centerSpaceRadius: 28,
              sections: [
                if (high > 0) PieChartSectionData(value: high.toDouble(), color: kDanger, title: '$high', radius: 44, titleStyle: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                if (medium > 0) PieChartSectionData(value: medium.toDouble(), color: kWarning, title: '$medium', radius: 44, titleStyle: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                if (low > 0) PieChartSectionData(value: low.toDouble(), color: kSuccess, title: '$low', radius: 44, titleStyle: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
              ],
            )),
          ),
          const SizedBox(width: 20),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
            _legend('High Risk', high, kDanger),
            const SizedBox(height: 10),
            _legend('Medium Risk', medium, kWarning),
            const SizedBox(height: 10),
            _legend('Low Risk', low, kSuccess),
            const SizedBox(height: 10),
            _legend('Total Clinics', total, kBrand),
          ])),
        ]),
      ),
    );
  }

  Widget _legend(String label, int count, Color color) => Row(children: [
    Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
    const SizedBox(width: 8),
    Text(label, style: const TextStyle(fontSize: 13)),
    const Spacer(),
    Text('$count', style: TextStyle(fontWeight: FontWeight.bold, color: color)),
  ]);

  Widget _actionsChart() {
    final open = (_dash!['open_corrective_actions'] ?? 0) as int;
    final overdue = (_dash!['overdue_corrective_actions'] ?? 0) as int;
    final resolved = (_dash!['resolved_corrective_actions'] ?? open) as int;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          _actionRow('Open', open, kWarning),
          const SizedBox(height: 10),
          _actionRow('Overdue', overdue, kDanger),
          const SizedBox(height: 10),
          _actionRow('Resolved', resolved, kSuccess),
        ]),
      ),
    );
  }

  Widget _actionRow(String label, int count, Color color) {
    final max = [
      (_dash!['open_corrective_actions'] ?? 0) as int,
      (_dash!['overdue_corrective_actions'] ?? 0) as int,
      (_dash!['resolved_corrective_actions'] ?? count) as int,
    ].fold(0, (a, b) => a > b ? a : b);
    final frac = max == 0 ? 0.0 : count / max;
    return Row(children: [
      SizedBox(width: 72, child: Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey))),
      Expanded(child: Stack(children: [
        Container(height: 20, decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(4))),
        FractionallySizedBox(
          widthFactor: frac,
          child: Container(height: 20, decoration: BoxDecoration(color: color.withOpacity(0.7), borderRadius: BorderRadius.circular(4))),
        ),
      ])),
      const SizedBox(width: 8),
      SizedBox(width: 30, child: Text('$count', style: TextStyle(fontWeight: FontWeight.bold, color: color))),
    ]);
  }

  Color _scoreColor(double score) {
    if (score >= 80) return kSuccess;
    if (score >= 60) return kWarning;
    return kDanger;
  }
}
