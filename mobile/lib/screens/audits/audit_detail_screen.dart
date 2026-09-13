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
  Map<String, dynamic>? _review;
  bool _loading = true;
  bool _acting = false;
  final _findingsCtrl = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _findingsCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/audits/reviews/${widget.id}');
      if (mounted) setState(() {
        _review = data;
        _findingsCtrl.text = data['findings'] ?? '';
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _decide(String status) async {
    setState(() => _acting = true);
    try {
      await ApiService().put('/audits/reviews/${widget.id}', {
        'status': status,
        'findings': _findingsCtrl.text,
        'risk_score': _review?['risk_score'],
        'risk_level': _review?['risk_level'],
      });
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Review $status'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_review == null) return const Scaffold(body: Center(child: Text('Review not found')));
    final review = _review!;
    final user = context.watch<AuthState>().user;
    final canReview = user?.canManage == true && review['status'] == 'pending';

    return Scaffold(
      appBar: AppBar(title: Text(review['clinic_name'] ?? 'Inspection #${review['inspection_id']}', overflow: TextOverflow.ellipsis)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  statusBadge(review['status']),
                  if (review['risk_level'] != null) ...[const SizedBox(width: 8), statusBadge(review['risk_level'])],
                  const Spacer(),
                  if (review['compliance_score'] != null)
                    Text('${(review['compliance_score'] as num).toStringAsFixed(1)}%',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: kBrand)),
                ]),
                const SizedBox(height: 12),
                if (review['clinic_name'] != null) _infoRow('Clinic', review['clinic_name']),
                if (review['inspector_name'] != null) _infoRow('Inspector', review['inspector_name']),
                _infoRow('Auditor', review['auditor_name']),
                if (review['reviewed_at'] != null) _infoRow('Reviewed', _fmtDate(review['reviewed_at'])),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Findings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          if (canReview)
            TextField(
              controller: _findingsCtrl,
              decoration: const InputDecoration(hintText: 'Add your review notes…'),
              maxLines: 4,
            )
          else
            Card(child: Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                (review['findings'] as String?)?.isNotEmpty == true ? review['findings'] : 'No findings recorded.',
                style: const TextStyle(fontSize: 14, height: 1.5),
              ),
            )),
          if (canReview) ...[
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: kSuccess),
                icon: const Icon(Icons.check_circle_outline),
                label: Text(_acting ? 'Processing…' : 'Approve'),
                onPressed: _acting ? null : () => _decide('approved'),
              )),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: kDanger),
                icon: const Icon(Icons.cancel_outlined),
                label: Text(_acting ? 'Processing…' : 'Reject'),
                onPressed: _acting ? null : () => _decide('rejected'),
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
