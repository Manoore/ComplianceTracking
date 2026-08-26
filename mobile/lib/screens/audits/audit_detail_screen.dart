import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class AuditDetailScreen extends StatefulWidget {
  final int id;
  const AuditDetailScreen({super.key, required this.id});
  @override
  State<AuditDetailScreen> createState() => _AuditDetailScreenState();
}

class _AuditDetailScreenState extends State<AuditDetailScreen> {
  Map<String, dynamic>? _audit;
  bool _loading = true;
  bool _acting = false;
  final _feedbackCtrl = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _feedbackCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/audits/${widget.id}');
      if (mounted) setState(() { _audit = data; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _action(String action) async {
    setState(() => _acting = true);
    try {
      await ApiService().post('/audits/${widget.id}/$action', {'feedback': _feedbackCtrl.text});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Audit $action'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_audit == null) return const Scaffold(body: Center(child: Text('Audit not found')));
    final audit = _audit!;
    final user = context.watch<AuthState>().user;
    final canReview = user?.canManage == true && audit['status'] == 'submitted';

    return Scaffold(
      appBar: AppBar(title: Text(audit['clinic_name'] ?? 'Audit', overflow: TextOverflow.ellipsis)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  statusBadge(audit['status']),
                  if (audit['risk_level'] != null) ...[const SizedBox(width: 8), statusBadge(audit['risk_level'])],
                  const Spacer(),
                  if (audit['overall_score'] != null)
                    Text('${(audit['overall_score'] as num).toStringAsFixed(1)}%',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: kBrand)),
                ]),
                const SizedBox(height: 12),
                _infoRow('Clinic', audit['clinic_name']),
                _infoRow('Auditor', audit['auditor_name']),
                if (audit['reviewed_at'] != null) _infoRow('Reviewed', _fmtDate(audit['reviewed_at'])),
                if (audit['feedback'] != null) ...[
                  const SizedBox(height: 8),
                  const Text('Feedback', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(audit['feedback'], style: const TextStyle(color: Colors.grey)),
                ],
              ]),
            ),
          ),
          if ((audit['findings'] as List? ?? []).isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Findings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ...(audit['findings'] as List).map((f) => Card(
              child: ListTile(
                leading: statusBadge(f['severity']),
                title: Text(f['description'] ?? ''),
                subtitle: f['recommendation'] != null ? Text(f['recommendation'], style: const TextStyle(fontSize: 12)) : null,
              ),
            )),
          ],
          if (canReview) ...[
            const SizedBox(height: 20),
            const Text('Review Decision', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            TextField(
              controller: _feedbackCtrl,
              decoration: const InputDecoration(labelText: 'Feedback / Comments', hintText: 'Add your review notes…'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: kSuccess),
                icon: const Icon(Icons.check_circle_outline),
                label: Text(_acting ? 'Processing…' : 'Approve'),
                onPressed: _acting ? null : () => _action('approve'),
              )),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: kDanger),
                icon: const Icon(Icons.cancel_outlined),
                label: Text(_acting ? 'Processing…' : 'Reject'),
                onPressed: _acting ? null : () => _action('reject'),
              )),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _infoRow(String label, dynamic value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(children: [
      Text('$label: ', style: const TextStyle(color: Colors.grey, fontSize: 13)),
      Text('${value ?? '—'}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
    ]),
  );

  String _fmtDate(String iso) {
    try { final d = DateTime.parse(iso); return '${d.day}/${d.month}/${d.year}'; } catch (_) { return iso; }
  }
}
