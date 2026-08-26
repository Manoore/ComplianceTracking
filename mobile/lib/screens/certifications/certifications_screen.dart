import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

class CertificationsScreen extends StatefulWidget {
  const CertificationsScreen({super.key});
  @override
  State<CertificationsScreen> createState() => _CertificationsScreenState();
}

class _CertificationsScreenState extends State<CertificationsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  List<Course> _courses = [];
  List<TeamCertification> _completions = [];
  bool _loadingCourses = true, _loadingCompletions = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _loadCourses();
    _loadCompletions();
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  Future<void> _loadCourses() async {
    try {
      final data = await ApiService().get('/certifications/courses') as List;
      if (mounted) setState(() { _courses = data.map((e) => Course.fromJson(e)).toList(); _loadingCourses = false; });
    } catch (_) { if (mounted) setState(() => _loadingCourses = false); }
  }

  Future<void> _loadCompletions() async {
    try {
      final data = await ApiService().get('/certifications/') as List;
      if (mounted) setState(() { _completions = data.map((e) => TeamCertification.fromJson(e)).toList(); _loadingCompletions = false; });
    } catch (_) { if (mounted) setState(() => _loadingCompletions = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Certifications'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          tabs: const [Tab(text: 'Courses'), Tab(text: 'My Completions')],
        ),
      ),
      drawer: const AppDrawer(),
      body: TabBarView(
        controller: _tabs,
        children: [
          RefreshIndicator(onRefresh: _loadCourses, child: _coursesTab()),
          RefreshIndicator(onRefresh: _loadCompletions, child: _completionsTab()),
        ],
      ),
    );
  }

  Widget _coursesTab() {
    if (_loadingCourses) return const Center(child: CircularProgressIndicator());
    if (_courses.isEmpty) return const Center(child: Text('No courses available', style: TextStyle(color: Colors.grey)));
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _courses.length,
      itemBuilder: (_, i) {
        final c = _courses[i];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.purple.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.workspace_premium_outlined, color: Colors.purple.shade600, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(c.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  Text('${c.quizCount} quiz section${c.quizCount != 1 ? 's' : ''}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                ])),
              ]),
              if (c.description != null) ...[
                const SizedBox(height: 8),
                Text(c.description!, style: const TextStyle(color: Colors.grey, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
              const SizedBox(height: 12),
              Row(children: [
                _pill('Pass: ${c.passThreshold.toStringAsFixed(0)}%', Colors.green),
                const SizedBox(width: 8),
                _pill('Valid: ${c.validityDays}d', Colors.blue),
              ]),
            ]),
          ),
        );
      },
    );
  }

  Widget _completionsTab() {
    if (_loadingCompletions) return const Center(child: CircularProgressIndicator());
    if (_completions.isEmpty) return const Center(child: Text('No completions yet', style: TextStyle(color: Colors.grey)));
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _completions.length,
      itemBuilder: (_, i) {
        final cert = _completions[i];
        return Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: statusColor(cert.status).withOpacity(0.15),
              child: Icon(Icons.workspace_premium, color: statusColor(cert.status)),
            ),
            title: Text(cert.courseTitle ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(cert.participantName),
              if (cert.score != null) Text('Score: ${cert.score!.toStringAsFixed(1)}%', style: const TextStyle(fontSize: 12)),
              statusBadge(cert.status),
            ]),
            trailing: cert.certificatePath != null
                ? IconButton(
                    icon: const Icon(Icons.download_outlined, color: kSuccess),
                    onPressed: () => launchUrl(Uri.parse('${ApiService().toString()}${cert.certificatePath}')),
                  )
                : null,
          ),
        );
      },
    );
  }

  Widget _pill(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
    child: Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
  );
}
