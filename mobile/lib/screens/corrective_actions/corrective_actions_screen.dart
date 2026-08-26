import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class CorrectiveActionsScreen extends StatefulWidget {
  const CorrectiveActionsScreen({super.key});
  @override
  State<CorrectiveActionsScreen> createState() => _CorrectiveActionsScreenState();
}

class _CorrectiveActionsScreenState extends State<CorrectiveActionsScreen> {
  List<CorrectiveAction> _actions = [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/corrective-actions') as List;
      if (mounted) setState(() { _actions = data.map((e) => CorrectiveAction.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _resolve(int id) async {
    try {
      await ApiService().patch('/corrective-actions/$id', {'status': 'resolved'});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Marked as resolved'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }

  List<CorrectiveAction> get _filtered {
    if (_filter == 'all') return _actions;
    return _actions.where((a) => a.status == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Corrective Actions')),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          Container(
            color: Colors.grey.shade50,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['all', 'open', 'in_progress', 'resolved'].map((f) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f.replaceAll('_', ' ')),
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
                      ? const Center(child: Text('No corrective actions', style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) {
                            final action = _filtered[i];
                            final priorityColor = action.priority == 'high' ? kDanger : action.priority == 'medium' ? kWarning : Colors.grey;
                            return Card(
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Row(children: [
                                    Expanded(child: Text(action.title, style: const TextStyle(fontWeight: FontWeight.w600))),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(color: priorityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                                      child: Text(action.priority, style: TextStyle(color: priorityColor, fontSize: 11, fontWeight: FontWeight.w600)),
                                    ),
                                  ]),
                                  if (action.description != null) ...[
                                    const SizedBox(height: 4),
                                    Text(action.description!, style: const TextStyle(color: Colors.grey, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                                  ],
                                  const SizedBox(height: 8),
                                  Row(children: [
                                    statusBadge(action.status),
                                    if (action.clinicName != null) ...[const SizedBox(width: 8), Text(action.clinicName!, style: const TextStyle(fontSize: 12, color: Colors.grey))],
                                    const Spacer(),
                                    if (action.dueDate != null) Text('Due: ${action.dueDate!.substring(0, 10)}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                  ]),
                                  if (action.status != 'resolved') ...[
                                    const SizedBox(height: 10),
                                    SizedBox(
                                      width: double.infinity,
                                      child: OutlinedButton.icon(
                                        icon: const Icon(Icons.check_circle_outline, size: 16),
                                        label: const Text('Mark Resolved'),
                                        onPressed: () => _resolve(action.id),
                                      ),
                                    ),
                                  ],
                                ]),
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
