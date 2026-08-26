import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> _notifications = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/notifications') as List;
      if (mounted) setState(() { _notifications = data.map((e) => AppNotification.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _markAllRead() async {
    try { await ApiService().post('/notifications/mark-all-read', {}); await _load(); } catch (_) {}
  }

  IconData _icon(String type) {
    switch (type) {
      case 'inspection': return Icons.search_outlined;
      case 'audit': return Icons.shield_outlined;
      case 'certification': return Icons.workspace_premium_outlined;
      case 'corrective_action': return Icons.warning_amber_outlined;
      default: return Icons.notifications_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = _notifications.where((n) => !n.isRead).length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (unread > 0) TextButton(
            onPressed: _markAllRead,
            child: const Text('Mark all read', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _notifications.isEmpty
                ? const Center(child: Text('No notifications', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _notifications.length,
                    itemBuilder: (_, i) {
                      final n = _notifications[i];
                      return Container(
                        color: n.isRead ? null : kBrand.withOpacity(0.04),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: kBrand.withOpacity(0.1),
                            child: Icon(_icon(n.type), color: kBrand, size: 20),
                          ),
                          title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.w600)),
                          subtitle: Text(n.body, style: const TextStyle(fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (n.createdAt != null) Text(_fmtDate(n.createdAt!), style: const TextStyle(fontSize: 10, color: Colors.grey)),
                              if (!n.isRead) Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 4), decoration: const BoxDecoration(color: kBrand, shape: BoxShape.circle)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  String _fmtDate(String iso) {
    try { final d = DateTime.parse(iso); return '${d.day}/${d.month}/${d.year}'; } catch (_) { return ''; }
  }
}
