import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

/// Queue of reviewer_only items awaiting this user's countersignature, across
/// whichever clinics they're allowed to review -- lets a Clinic Lead/Regional
/// Manager/Director of Operations/Admin review and submit directly instead of
/// having to open each submitted checklist individually to find it. Priority
/// checklists (flagged by the MA at submit time) sort to the top.
class PendingReviewsScreen extends StatefulWidget {
  const PendingReviewsScreen({super.key});

  @override
  State<PendingReviewsScreen> createState() => _PendingReviewsScreenState();
}

class _PendingReviewsScreenState extends State<PendingReviewsScreen> {
  List<Map<String, dynamic>> _reviews = [];
  bool _loading = true;
  final Set<int> _signing = {};
  final Map<int, TextEditingController> _notes = {};
  final Map<int, bool> _flagged = {};

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _notes.values.forEach((c) => c.dispose()); super.dispose(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/inspections/pending-review') as List;
      if (mounted) setState(() {
        _reviews = data.cast<Map<String, dynamic>>();
        _loading = false;
        for (final r in _reviews) {
          final itemId = r['item_id'] as int;
          _notes.putIfAbsent(itemId, () => TextEditingController());
          _flagged.putIfAbsent(itemId, () => false);
        }
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sign(Map<String, dynamic> review) async {
    final itemId = review['item_id'] as int;
    final flagged = _flagged[itemId] ?? false;
    final notes = _notes[itemId]?.text.trim();
    setState(() => _signing.add(itemId));
    try {
      await ApiService().post(
        '/inspections/${review['inspection_id']}/items/$itemId/second-sign',
        {
          'signature': 'signed:${DateTime.now().toIso8601String()}',
          if (notes != null && notes.isNotEmpty) 'notes': notes,
          'flagged': flagged,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(flagged ? 'Review recorded and flagged for your Regional Manager' : 'Review recorded'),
          backgroundColor: kSuccess,
        ));
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
                      final isPriority = r['is_priority'] == true;
                      final flagged = _flagged[itemId] ?? false;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: isPriority
                            ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: const BorderSide(color: kWarning, width: 2))
                            : null,
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            if (isPriority) Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Row(children: [
                                const Icon(Icons.priority_high, size: 14, color: kWarning),
                                const SizedBox(width: 4),
                                Expanded(child: Text(
                                  'Priority${r['priority_note'] != null ? ' — ${r['priority_note']}' : ''}',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kWarning),
                                )),
                              ]),
                            ),
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
                            const SizedBox(height: 10),
                            TextField(
                              controller: _notes[itemId],
                              decoration: const InputDecoration(hintText: 'Review notes (optional)', isDense: true),
                            ),
                            const SizedBox(height: 4),
                            CheckboxListTile(
                              value: flagged,
                              onChanged: (v) => setState(() => _flagged[itemId] = v ?? false),
                              contentPadding: EdgeInsets.zero,
                              controlAffinity: ListTileControlAffinity.leading,
                              dense: true,
                              title: const Text('Flag for Regional Manager', style: TextStyle(fontSize: 13)),
                              secondary: Icon(Icons.flag, size: 16, color: flagged ? kDanger : Colors.grey),
                            ),
                            SizedBox(
                              width: double.infinity,
                              child: flagged
                                  ? ElevatedButton.icon(
                                      style: ElevatedButton.styleFrom(backgroundColor: kDanger, foregroundColor: Colors.white),
                                      icon: const Icon(Icons.draw_outlined, size: 16),
                                      label: Text(signing ? 'Submitting…' : 'Submit & Flag'),
                                      onPressed: signing ? null : () => _sign(r),
                                    )
                                  : OutlinedButton.icon(
                                      icon: const Icon(Icons.draw_outlined, size: 16),
                                      label: Text(signing ? 'Submitting…' : 'Submit Review'),
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
