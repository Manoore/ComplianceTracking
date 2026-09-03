import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
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

  Future<void> _updateStatus(int id, String status) async {
    try {
      await ApiService().patch('/corrective-actions/$id', {'status': status});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Status updated to $status'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }

  List<CorrectiveAction> get _filtered {
    if (_filter == 'all') return _actions;
    return _actions.where((a) => a.status == _filter).toList();
  }

  void _showDetail(BuildContext context, CorrectiveAction action) {
    final auth = context.read<AuthState>();
    final canManage = auth.user?.canManage ?? false;
    final priorityColor = action.priority == 'high' ? kDanger : action.priority == 'medium' ? kWarning : kSuccess;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        maxChildSize: 0.92,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollCtrl) => SingleChildScrollView(
          controller: scrollCtrl,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Text(action.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: priorityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                child: Text(action.priority.toUpperCase(), style: TextStyle(color: priorityColor, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              statusBadge(action.status),
              if (action.clinicName != null) ...[
                const SizedBox(width: 8),
                const Icon(Icons.local_hospital_outlined, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(action.clinicName!, style: const TextStyle(fontSize: 13, color: Colors.grey)),
              ],
            ]),
            const SizedBox(height: 16),
            if (action.description != null) ...[
              const Text('Description', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 4),
              Text(action.description!, style: const TextStyle(fontSize: 14, height: 1.5)),
              const SizedBox(height: 16),
            ],
            _detailRow(Icons.calendar_today_outlined, 'Due Date', action.dueDate?.substring(0, 10) ?? '—'),
            if (action.assignedTo != null) _detailRow(Icons.person_outline, 'Assigned To', action.assignedTo!),
            const SizedBox(height: 20),

            if (canManage && action.status != 'resolved') ...[
              const Text('Update Status', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              const SizedBox(height: 10),
              Row(children: [
                if (action.status == 'open')
                  Expanded(child: OutlinedButton.icon(
                    icon: const Icon(Icons.play_arrow_outlined, size: 16),
                    label: const Text('In Progress'),
                    onPressed: () { Navigator.pop(ctx); _updateStatus(action.id, 'in_progress'); },
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.blue, side: const BorderSide(color: Colors.blue)),
                  )),
                if (action.status != 'open') const SizedBox.shrink(),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton.icon(
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('Resolve'),
                  onPressed: () { Navigator.pop(ctx); _resolve(action.id); },
                  style: OutlinedButton.styleFrom(foregroundColor: kSuccess, side: const BorderSide(color: kSuccess)),
                )),
              ]),
            ],

            if (canManage && (action.requiresReinspection == true)) ...[
              const SizedBox(height: 12),
              SizedBox(width: double.infinity, child: OutlinedButton.icon(
                icon: const Icon(Icons.refresh_outlined, color: Colors.orange),
                label: const Text('Schedule Re-Inspection', style: TextStyle(color: Colors.orange)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.orange)),
                onPressed: () {
                  Navigator.pop(ctx);
                  context.go('/inspections');
                },
              )),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Icon(icon, size: 16, color: Colors.grey),
      const SizedBox(width: 8),
      Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
      const Spacer(),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final canManage = auth.user?.canManage ?? false;

    // Summary counts
    final open = _actions.where((a) => a.status == 'open').length;
    final inProgress = _actions.where((a) => a.status == 'in_progress').length;
    final resolved = _actions.where((a) => a.status == 'resolved').length;

    return Scaffold(
      appBar: AppBar(title: const Text('Corrective Actions')),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          // Summary strip
          Container(
            color: Colors.grey.shade50,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(children: [
              _summaryPill('$open Open', kWarning),
              const SizedBox(width: 8),
              _summaryPill('$inProgress In Progress', Colors.blue),
              const SizedBox(width: 8),
              _summaryPill('$resolved Resolved', kSuccess),
            ]),
          ),
          // Filter chips
          Container(
            color: Colors.grey.shade50,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
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
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) {
                            final action = _filtered[i];
                            final priorityColor = action.priority == 'high' ? kDanger : action.priority == 'medium' ? kWarning : kSuccess;
                            final isOverdue = action.dueDate != null &&
                                DateTime.tryParse(action.dueDate!)?.isBefore(DateTime.now()) == true &&
                                action.status != 'resolved';
                            return Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: () => _showDetail(context, action),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Row(children: [
                                      Expanded(child: Text(action.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(color: priorityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                                        child: Text(action.priority.toUpperCase(), style: TextStyle(color: priorityColor, fontSize: 10, fontWeight: FontWeight.bold)),
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
                                      if (action.dueDate != null)
                                        Row(children: [
                                          Icon(isOverdue ? Icons.warning_amber_outlined : Icons.calendar_today_outlined,
                                            size: 12, color: isOverdue ? kDanger : Colors.grey),
                                          const SizedBox(width: 3),
                                          Text('${isOverdue ? 'Overdue: ' : ''}${action.dueDate!.substring(0, 10)}',
                                            style: TextStyle(fontSize: 11, color: isOverdue ? kDanger : Colors.grey, fontWeight: isOverdue ? FontWeight.w600 : FontWeight.normal)),
                                        ]),
                                    ]),
                                    if (canManage && action.status != 'resolved') ...[
                                      const SizedBox(height: 10),
                                      Row(children: [
                                        Expanded(child: OutlinedButton.icon(
                                          icon: const Icon(Icons.check_circle_outline, size: 15),
                                          label: const Text('Resolve'),
                                          style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), foregroundColor: kSuccess, side: const BorderSide(color: kSuccess)),
                                          onPressed: () => _resolve(action.id),
                                        )),
                                        const SizedBox(width: 8),
                                        Expanded(child: OutlinedButton.icon(
                                          icon: const Icon(Icons.info_outline, size: 15),
                                          label: const Text('Details'),
                                          style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                                          onPressed: () => _showDetail(context, action),
                                        )),
                                      ]),
                                    ],
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

  Widget _summaryPill(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
    child: Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
  );
}
