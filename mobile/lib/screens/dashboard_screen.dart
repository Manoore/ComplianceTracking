import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/app_drawer.dart';
import '../widgets/offline_banner.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/reports/dashboard');
      if (mounted) setState(() { _stats = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard'), actions: [
        IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () => context.push('/notifications')),
      ]),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(child: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text('Welcome back, ${user?.fullName ?? ''}!',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  Text(
                    (user?.role ?? '').replaceAll('_', ' ').toUpperCase(),
                    style: const TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                  const SizedBox(height: 20),
                  if (_stats != null) ...[
                    _statGrid(),
                    const SizedBox(height: 20),
                    _quickActions(context, user?.canAudit ?? false, user?.canManage ?? false),
                  ] else
                    const Center(child: Text('Could not load stats', style: TextStyle(color: Colors.grey))),
                ],
              ),
          )),
        ],
      ),
    );
  }

  Widget _statGrid() {
    final s = _stats!;
    final cards = [
      _StatCard('Total Clinics', '${s['total_clinics'] ?? 0}', Icons.local_hospital_outlined, kBrand),
      _StatCard('Inspections', '${s['total_inspections'] ?? 0}', Icons.search_outlined, Colors.indigo),
      _StatCard('Open Actions', '${s['open_corrective_actions'] ?? 0}', Icons.warning_amber_outlined, kWarning),
      _StatCard('Avg Score', '${((s['avg_compliance_score'] ?? 0) as num).toStringAsFixed(1)}%', Icons.bar_chart_outlined, kSuccess),
    ];
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.4,
      children: cards,
    );
  }

  Widget _quickActions(BuildContext context, bool canAudit, bool canManage) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10, runSpacing: 10,
          children: [
            if (canAudit) _actionChip(context, Icons.add_circle_outline, 'New Inspection', '/inspections/new'),
            _actionChip(context, Icons.workspace_premium_outlined, 'Certifications', '/certifications'),
            _actionChip(context, Icons.warning_amber_outlined, 'Corrective Actions', '/corrective-actions'),
            _actionChip(context, Icons.campaign_outlined, 'Announcements', '/announcements'),
            if (canManage) _actionChip(context, Icons.bar_chart_outlined, 'Reports', '/admin/reports'),
          ],
        ),
      ],
    );
  }

  Widget _actionChip(BuildContext context, IconData icon, String label, String route) {
    return ActionChip(
      avatar: Icon(icon, size: 18, color: kBrand),
      label: Text(label),
      onPressed: () => context.push(route),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color, size: 28),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ]),
        ],
      ),
    );
  }
}
