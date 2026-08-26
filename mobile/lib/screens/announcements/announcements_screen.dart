import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});
  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<Announcement> _announcements = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/announcements') as List;
      if (mounted) setState(() { _announcements = data.map((e) => Announcement.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _markRead(int id) async {
    try { await ApiService().post('/announcements/$id/read', {}); } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    return Scaffold(
      appBar: AppBar(title: const Text('Announcements')),
      drawer: const AppDrawer(),
      floatingActionButton: user?.canManage == true
          ? FloatingActionButton(
              backgroundColor: kBrand,
              child: const Icon(Icons.add, color: Colors.white),
              onPressed: () => _showCreate(context),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _announcements.isEmpty
                ? const Center(child: Text('No announcements', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _announcements.length,
                    itemBuilder: (_, i) {
                      final ann = _announcements[i];
                      if (!ann.isRead) _markRead(ann.id);
                      final priorityColor = ann.priority == 'urgent' ? kDanger : ann.priority == 'high' ? kWarning : kBrand;
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(child: Text(ann.title, style: TextStyle(fontWeight: ann.isRead ? FontWeight.w500 : FontWeight.bold, fontSize: 15))),
                              Container(
                                width: 8, height: 8,
                                decoration: BoxDecoration(color: ann.isRead ? Colors.transparent : kBrand, shape: BoxShape.circle),
                              ),
                            ]),
                            const SizedBox(height: 6),
                            Text(ann.content, style: const TextStyle(color: Colors.grey, fontSize: 13), maxLines: 3, overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 8),
                            Row(children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: priorityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                                child: Text(ann.priority, style: TextStyle(color: priorityColor, fontSize: 11, fontWeight: FontWeight.w600)),
                              ),
                              const Spacer(),
                              if (ann.createdAt != null) Text(_fmtDate(ann.createdAt!), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                            ]),
                          ]),
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  void _showCreate(BuildContext context) {
    final titleCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
    String priority = 'normal';
    showModalBottomSheet(
      context: context, isScrollControlled: true, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('New Announcement', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 16),
            TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Title *')),
            const SizedBox(height: 12),
            TextField(controller: bodyCtrl, decoration: const InputDecoration(labelText: 'Content *'), maxLines: 3),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: priority,
              decoration: const InputDecoration(labelText: 'Priority'),
              items: ['normal', 'high', 'urgent'].map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
              onChanged: (v) => setSheet(() => priority = v!),
            ),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: () async {
                if (titleCtrl.text.isEmpty || bodyCtrl.text.isEmpty) return;
                await ApiService().post('/announcements', {'title': titleCtrl.text, 'content': bodyCtrl.text, 'priority': priority});
                Navigator.pop(ctx);
                _load();
              },
              child: const Text('Post Announcement'),
            )),
          ]),
        ),
      ),
    );
  }

  String _fmtDate(String iso) {
    try { final d = DateTime.parse(iso); return '${d.day}/${d.month}/${d.year}'; } catch (_) { return ''; }
  }
}
