import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

/// Queue of reviewer_only items awaiting this user's countersignature, across
/// whichever clinics they're allowed to review -- lets a Clinic Lead/Regional
/// Manager/Director of Operations/Admin sign directly instead of having to open
/// each submitted checklist individually to find it.
class PendingReviewsScreen extends StatefulWidget {
  const PendingReviewsScreen({super.key});

  @override
  State<PendingReviewsScreen> createState() => _PendingReviewsScreenState();
}

class _PendingReviewsScreenState extends State<PendingReviewsScreen> {
  List<Map<String, dynamic>> _reviews = [];
  bool _loading = true;
  final Set<int> _signing = {};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/inspections/pending-review') as List;
      if (mounted) setState(() { _reviews = data.cast<Map<String, dynamic>>(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sign(Map<String, dynamic> review) async {
    final itemId = review['item_id'] as int;
    setState(() => _signing.add(itemId));
    try {
      await ApiService().post(
        '/inspections/${review['inspection_id']}/items/$itemId/second-sign',
        {'signature': 'signed:${DateTime.now().toIso8601String()}'},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Review recorded'), backgroundColor: kSuccess));
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
        setState(() => _signing.remove(itemId));
      }
    }
  }

  String _fmtDate(String? iso) {
    if (iso == null) return '';
    try { final d = DateTime.parse(iso); return '${d.day}/${d.month}/${d.year}'; } catch (_) { return ''; }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pending Reviews')),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _reviews.isEmpty
                ? ListView(children: const [
                    SizedBox(height: 120),
                    Center(child: Icon(Icons.fact_check_outlined, size: 40, color: Colors.grey)),
                    SizedBox(height: 12),
                    Center(child: Text('Nothing waiting on your review right now.', style: TextStyle(color: Colors.grey))),
                  ])
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _reviews.length,
                    itemBuilder: (_, i) {
                      final r = _reviews[i];
                      final itemId = r['item_id'] as int;
                      final signing = _signing.contains(itemId);
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            GestureDetector(
                              onTap: () => context.push('/inspections/${r['inspection_id']}'),
                              child: Text(
                                r['clinic_name'] ?? 'Unknown clinic',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: kBrand),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                if (r['template_name'] != null) r['template_name'],
                                if (r['inspector_name'] != null) r['inspector_name'],
                                if (r['submitted_at'] != null) _fmtDate(r['submitted_at']),
                              ].join(' · '),
                              style: const TextStyle(fontSize: 12, color: Colors.grey),
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.draw_outlined, size: 16),
                                label: Text(signing ? 'Signing…' : 'Tap to Sign'),
                                onPressed: signing ? null : () => _sign(r),
                              ),
                            ),
                          ]),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
