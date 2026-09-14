import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

const kHierarchyRoleLabels = <String, String>{
  'clinic_lead': 'Clinic Lead',
  'regional_manager': 'Regional Manager',
  'director_of_operations': 'Director of Operations',
};

class ExecutiveDashboardScreen extends StatefulWidget {
  const ExecutiveDashboardScreen({super.key});
  @override
  State<ExecutiveDashboardScreen> createState() => _ExecutiveDashboardScreenState();
}

class _ExecutiveDashboardScreenState extends State<ExecutiveDashboardScreen> {
  Map<String, dynamic>? _dash;
  List<Map<String, dynamic>> _clinics = [];
  bool _loading = true;

  Map<String, dynamic>? _hierarchy;
  bool _hierarchyLoading = true;
  String _region = '';
  int? _viewAsUserId;
  List<AppUser> _hierarchyUsers = [];
  final Set<String> _collapsedRegions = {};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService().get('/reports/dashboard'),
        ApiService().get('/clinics').catchError((_) => <dynamic>[]),
      ]);
      if (mounted) setState(() {
        _dash = results[0] as Map<String, dynamic>;
        _clinics = (results[1] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }

    await _loadHierarchy();

    final isAdmin = mounted ? context.read<AuthState>().user?.role == 'admin' : false;
    if (isAdmin) {
      try {
        final users = await ApiService().get('/users') as List;
        if (mounted) setState(() {
          _hierarchyUsers = users.map((e) => AppUser.fromJson(e))
              .where((u) => u.customRole != null && kHierarchyRoleLabels.containsKey(u.customRole))
              .toList();
        });
      } catch (_) {}
    }
  }

  Future<void> _loadHierarchy() async {
    setState(() => _hierarchyLoading = true);
    try {
      final params = <String>[];
      if (_region.isNotEmpty) params.add('region=${Uri.encodeQueryComponent(_region)}');
      if (_viewAsUserId != null) params.add('view_as_user_id=$_viewAsUserId');
      final path = '/reports/hierarchy${params.isNotEmpty ? '?${params.join('&')}' : ''}';
      final data = await ApiService().get(path);
      if (mounted) setState(() { _hierarchy = data as Map<String, dynamic>; _hierarchyLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _hierarchyLoading = false);
    }
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
                      _hierarchyCard(context),
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
    final s = _dash!['summary'] as Map<String, dynamic>? ?? {};
    final avg = (s['avg_compliance_score'] ?? 0) as num;
    return Row(children: [
      Expanded(child: _kpiCard('Avg Score', '${avg.toStringAsFixed(1)}%', _scoreColor(avg.toDouble()), Icons.bar_chart_outlined)),
      const SizedBox(width: 10),
      Expanded(child: _kpiCard('Clinics', '${_clinics.length}', kBrand, Icons.local_hospital_outlined)),
      const SizedBox(width: 10),
      Expanded(child: _kpiCard('Open Actions', '${s['open_corrective_actions'] ?? 0}', kWarning, Icons.warning_amber_outlined)),
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

  Widget _hierarchyPicker({
    required String? value,
    required String placeholder,
    required List<String> values,
    required String Function(String) labelFor,
    required void Function(String?)? onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(placeholder, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          isDense: true,
          style: const TextStyle(fontSize: 12, color: Colors.black87),
          items: values.map((v) => DropdownMenuItem(value: v, child: Text(labelFor(v)))).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _dailyStatusPill(String status) {
    Color bg, fg;
    String label;
    switch (status) {
      case 'submitted': bg = kSuccess.withValues(alpha: 0.12); fg = kSuccess; label = 'Submitted'; break;
      case 'missing': bg = kDanger.withValues(alpha: 0.12); fg = kDanger; label = 'Missing'; break;
      default: bg = Colors.grey.shade200; fg = Colors.grey.shade600; label = 'No daily checklist';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }

  Widget _hierarchyCard(BuildContext context) {
    final isAdmin = context.watch<AuthState>().user?.role == 'admin';

    if (_hierarchyLoading && _hierarchy == null) {
      return const Card(child: Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      ));
    }
    if (_hierarchy == null) return const SizedBox.shrink();

    final h = _hierarchy!;
    final hasDaily = h['has_templates'] == true;
    final availableRegions = (h['available_regions'] as List?)?.cast<String>() ?? [];
    final viewingAs = h['viewing_as'] as Map<String, dynamic>?;

    final regionValues = ['', ...availableRegions];
    final userValues = ['', ..._hierarchyUsers.map((u) => u.id.toString())];

    final pickers = Wrap(spacing: 8, runSpacing: 8, children: [
      if (availableRegions.length > 1)
        _hierarchyPicker(
          value: _region,
          placeholder: 'All Regions',
          values: regionValues,
          labelFor: (v) => v.isEmpty ? 'All Regions' : v,
          onChanged: (v) {
            setState(() => _region = v ?? '');
            _loadHierarchy();
          },
        ),
      if (isAdmin)
        _hierarchyPicker(
          value: _viewAsUserId?.toString() ?? '',
          placeholder: _hierarchyUsers.isEmpty ? 'View as… (no one assigned yet)' : 'View as…',
          values: userValues,
          labelFor: (v) {
            if (v.isEmpty) return _hierarchyUsers.isEmpty ? 'View as… (no one assigned yet)' : 'View as…';
            final u = _hierarchyUsers.firstWhere((x) => x.id.toString() == v);
            final label = kHierarchyRoleLabels[u.customRole] ?? u.customRole ?? '';
            return '${u.fullName} ($label${u.managedRegion != null ? ' — ${u.managedRegion}' : ''})';
          },
          onChanged: _hierarchyUsers.isEmpty ? null : (v) {
            setState(() {
              _viewAsUserId = (v == null || v.isEmpty) ? null : int.parse(v);
              _region = '';
            });
            _loadHierarchy();
          },
        ),
    ]);

    if (!hasDaily) {
      return Card(child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.assignment_turned_in_outlined, color: kBrand, size: 18),
            SizedBox(width: 8),
            Text('Daily Checklist Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          ]),
          const SizedBox(height: 10),
          pickers,
          const SizedBox(height: 10),
          const Text(
            'No template is marked as "daily" yet. Set a template\'s frequency to Daily on the Templates page to start tracking completion here.',
            style: TextStyle(color: Colors.grey, fontSize: 13),
          ),
        ]),
      ));
    }

    final summary = h['summary'] as Map<String, dynamic>;
    final totalClinics = summary['total_clinics'] as int;
    final submittedToday = summary['submitted'] as int;
    final missingToday = summary['missing'] as int;
    final pct = totalClinics > 0 ? ((submittedToday / totalClinics) * 100).round() : 0;
    final missingClinics = (h['missing_clinics'] as List).cast<Map<String, dynamic>>();
    final regions = (h['regions'] as List).cast<Map<String, dynamic>>();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.assignment_turned_in_outlined, color: kBrand, size: 18),
            SizedBox(width: 8),
            Text('Daily Checklist Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          ]),
          const SizedBox(height: 10),
          pickers,
          if (viewingAs != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: kBrand.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                const Icon(Icons.visibility_outlined, size: 14, color: kBrand),
                const SizedBox(width: 6),
                Expanded(child: Text(
                  'Viewing as ${viewingAs['full_name']}'
                  '${viewingAs['custom_role'] != null ? ' (${kHierarchyRoleLabels[viewingAs['custom_role']] ?? viewingAs['custom_role']})' : ''}',
                  style: const TextStyle(fontSize: 12, color: kBrand, fontWeight: FontWeight.w600),
                )),
                GestureDetector(
                  onTap: () { setState(() => _viewAsUserId = null); _loadHierarchy(); },
                  child: const Icon(Icons.close, size: 14, color: kBrand),
                ),
              ]),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            '${h['scope_label']} · $submittedToday of $totalClinics clinics submitted today\'s checklist ($pct%)',
            style: const TextStyle(fontSize: 12, color: Colors.grey),
          ),
          if (missingToday > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: kDanger.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(8)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('$missingToday clinic${missingToday != 1 ? 's' : ''} missing today\'s checklist',
                    style: const TextStyle(color: kDanger, fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                ...missingClinics.map((c) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(children: [
                    Expanded(child: Text('${c['clinic_name']} · ${c['region']}', style: const TextStyle(fontSize: 12))),
                    Text(c['manager_name'] ?? 'No lead assigned', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  ]),
                )),
              ]),
            ),
          ],
          const SizedBox(height: 12),
          ...regions.map((r) {
            final region = r['region'] as String;
            final collapsed = _collapsedRegions.contains(region);
            final rClinics = (r['clinics'] as List).cast<Map<String, dynamic>>();
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(8)),
              child: Column(children: [
                InkWell(
                  onTap: () => setState(() {
                    if (collapsed) { _collapsedRegions.remove(region); } else { _collapsedRegions.add(region); }
                  }),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(children: [
                      Icon(collapsed ? Icons.expand_more : Icons.expand_less, size: 16, color: Colors.grey.shade700),
                      const SizedBox(width: 6),
                      Expanded(child: Text(region, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                      Text('${r['submitted']}/${r['total']} submitted', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                    ]),
                  ),
                ),
                if (!collapsed)
                  ...rClinics.map((c) => Padding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                    child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(c['clinic_name'], style: const TextStyle(fontSize: 12)),
                        Text(c['manager_name'] ?? 'No lead assigned', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                      ])),
                      if ((c['open_corrective_actions'] as int) > 0) ...[
                        Text('${c['open_corrective_actions']} open', style: const TextStyle(fontSize: 10, color: Colors.orange)),
                        const SizedBox(width: 6),
                      ],
                      _dailyStatusPill(c['status'] as String),
                    ]),
                  )),
              ]),
            );
          }),
        ]),
      ),
    );
  }

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
    final s = _dash!['summary'] as Map<String, dynamic>? ?? {};
    final open = (s['open_corrective_actions'] ?? 0) as int;
    final overdue = (s['overdue_corrective_actions'] ?? 0) as int;
    final resolved = (s['resolved_corrective_actions'] ?? open) as int;

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
    final s = _dash!['summary'] as Map<String, dynamic>? ?? {};
    final max = [
      (s['open_corrective_actions'] ?? 0) as int,
      (s['overdue_corrective_actions'] ?? 0) as int,
      (s['resolved_corrective_actions'] ?? count) as int,
    ].fold(0, (a, b) => a > b ? a : b);
    final frac = max == 0 ? 0.0 : count / max;
    return Row(children: [
      SizedBox(width: 72, child: Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey))),
      Expanded(child: Stack(children: [
        Container(height: 20, decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(4))),
        FractionallySizedBox(
          widthFactor: frac,
          child: Container(height: 20, decoration: BoxDecoration(color: color.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(4))),
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
