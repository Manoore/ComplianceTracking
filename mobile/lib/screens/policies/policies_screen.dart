import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class PoliciesScreen extends StatefulWidget {
  const PoliciesScreen({super.key});
  @override
  State<PoliciesScreen> createState() => _PoliciesScreenState();
}

class _PoliciesScreenState extends State<PoliciesScreen> {
  List<Map<String, dynamic>> _policies = [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/policies/') as List;
      if (mounted) setState(() {
        _policies = data.cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'all') return _policies;
    if (_filter == 'pending') {
      return _policies.where((p) {
        final att = p['my_attestation'] as Map?;
        return att == null || att['status'] == 'pending' || att['status'] == 'read';
      }).toList();
    }
    if (_filter == 'signed') {
      return _policies.where((p) {
        final att = p['my_attestation'] as Map?;
        return att != null && att['status'] == 'signed';
      }).toList();
    }
    return _policies;
  }

  Color _attColor(Map? att) {
    if (att == null) return Colors.grey;
    switch (att['status']) {
      case 'signed': return kSuccess;
      case 'quiz_failed': return kDanger;
      case 'read': return kWarning;
      default: return Colors.grey;
    }
  }

  IconData _attIcon(Map? att) {
    if (att == null) return Icons.hourglass_empty_outlined;
    switch (att['status']) {
      case 'signed': return Icons.check_circle_outline;
      case 'quiz_failed': return Icons.cancel_outlined;
      case 'read': return Icons.visibility_outlined;
      default: return Icons.hourglass_empty_outlined;
    }
  }

  String _attLabel(Map? att) {
    if (att == null) return 'Pending';
    switch (att['status']) {
      case 'signed': return 'Signed';
      case 'quiz_failed': return 'Quiz Failed';
      case 'read': return 'Read';
      default: return 'Pending';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Policies')),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          Container(
            color: Colors.grey.shade50,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['all', 'pending', 'signed'].map((f) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f[0].toUpperCase() + f.substring(1)),
                    selected: _filter == f,
                    selectedColor: kBrand,
                    labelStyle: TextStyle(color: _filter == f ? Colors.white : null),
                    onSelected: (_) => setState(() => _filter = f),
                  ),
                )).toList(),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? const Center(child: Text('No policies', style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) {
                            final p = _filtered[i];
                            final att = p['my_attestation'] as Map?;
                            final color = _attColor(att);
                            return Card(
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: () => context.push('/policies/${p['id']}').then((_) => _load()),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Row(children: [
                                      Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(color: kBrand.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
                                        child: const Icon(Icons.policy_outlined, color: kBrand, size: 22),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text(p['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                        if (p['category'] != null)
                                          Text(p['category'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                      ])),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
                                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                                          Icon(_attIcon(att), color: color, size: 13),
                                          const SizedBox(width: 4),
                                          Text(_attLabel(att), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
                                        ]),
                                      ),
                                    ]),
                                    if (p['description'] != null) ...[
                                      const SizedBox(height: 8),
                                      Text(p['description'], style: const TextStyle(color: Colors.grey, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                                    ],
                                    const SizedBox(height: 8),
                                    Row(children: [
                                      Text('v${p['version'] ?? '1.0'}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                      if (p['requires_quiz'] == true) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(4)),
                                          child: Text('Quiz required', style: TextStyle(color: Colors.orange.shade700, fontSize: 10, fontWeight: FontWeight.w600)),
                                        ),
                                      ],
                                      const Spacer(),
                                      const Icon(Icons.chevron_right, color: Colors.grey, size: 18),
                                    ]),
                                  ]),
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }
}
