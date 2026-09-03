import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/permissions_service.dart';
import '../theme.dart' show kBrand, kBrand100, kDeepNavy, kTeal;
import 'complinow_mark.dart';

class AppDrawer extends StatefulWidget {
  const AppDrawer({super.key});

  @override
  State<AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends State<AppDrawer> {
  String? _orgName;

  @override
  void initState() {
    super.initState();
    _loadOrgName();
  }

  Future<void> _loadOrgName() async {
    try {
      final data = await ApiService().get('/tenants/me');
      if (mounted) setState(() => _orgName = data['name'] as String?);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final perms = context.watch<PermissionsService>();
    final user = auth.user;

    final displayRole = user?.customRole?.replaceAll('_', ' ') ?? user?.role.replaceAll('_', ' ') ?? '';
    final isAdmin = user?.role == 'admin';
    final canManage = user?.canManage ?? false;

    return Drawer(
      child: Column(
        children: [
          // Header
          Container(
            width: double.infinity,
            color: kBrand,
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 16,
              left: 20, right: 20, bottom: 16,
            ),
            child: Row(
              children: [
                const CompliNowMark(size: 48),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _orgName ?? 'CompliNow',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        user?.fullName ?? '',
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        displayRole,
                        style: const TextStyle(color: Colors.white54, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _tile(context, Icons.dashboard_outlined, 'Dashboard', '/'),
                if (perms.canView('clinics'))
                  _tile(context, Icons.local_hospital_outlined, 'Clinics', '/admin/clinics'),
                if (perms.canView('inspections'))
                  _tile(context, Icons.search_outlined, 'Inspections', '/inspections'),
                if (perms.canView('audits'))
                  _tile(context, Icons.shield_outlined, 'Audits', '/audits'),
                if (perms.canView('certifications'))
                  _tile(context, Icons.workspace_premium_outlined, 'Certifications', '/certifications'),
                _tile(context, Icons.policy_outlined, 'Policies', '/policies'),
                _tile(context, Icons.badge_outlined, 'Credentials', '/credentials'),
                if (perms.canView('corrective_actions'))
                  _tile(context, Icons.warning_amber_outlined, 'Corrective Actions', '/corrective-actions'),
                if (perms.canView('announcements'))
                  _tile(context, Icons.campaign_outlined, 'Announcements', '/announcements'),
                _tile(context, Icons.notifications_outlined, 'Notifications', '/notifications'),

                // Admin section
                if (perms.canView('reports') || perms.canView('users') || perms.canView('roles') || canManage) ...[
                  const Divider(),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Text('ADMIN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey)),
                  ),
                  if (isAdmin || canManage)
                    _tile(context, Icons.insights_outlined, 'Executive Dashboard', '/admin/executive'),
                  if (perms.canView('reports'))
                    _tile(context, Icons.bar_chart_outlined, 'Reports', '/admin/reports'),
                  if (perms.canView('users'))
                    _tile(context, Icons.people_outline, 'Users', '/admin/users'),
                  if (perms.canView('roles'))
                    _tile(context, Icons.admin_panel_settings_outlined, 'Roles & Permissions', '/admin/roles'),
                ],

                const Divider(),
                _tile(context, Icons.person_outline, 'My Profile', '/profile'),
              ],
            ),
          ),

          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
            onTap: () async {
              await auth.logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, IconData icon, String label, String route) {
    final current = GoRouterState.of(context).matchedLocation;
    final isActive = route == '/' ? current == '/' : current.startsWith(route);
    return ListTile(
      leading: Icon(icon, color: isActive ? kTeal : null),
      title: Text(label, style: TextStyle(
        fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
        color: isActive ? kTeal : null,
      )),
      selected: isActive,
      selectedTileColor: kBrand100,
      onTap: () { Navigator.pop(context); context.go(route); },
    );
  }
}
