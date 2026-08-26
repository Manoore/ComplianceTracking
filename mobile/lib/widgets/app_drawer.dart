import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../main.dart';
import '../services/permissions_service.dart';
import '../theme.dart';
import 'complinow_mark.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final perms = context.watch<PermissionsService>();
    final user = auth.user;

    final displayRole = user?.customRole?.replaceAll('_', ' ') ?? user?.role.replaceAll('_', ' ') ?? '';

    return Drawer(
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(color: kBrand),
            accountName: Text(user?.fullName ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
            accountEmail: Text(displayRole, style: const TextStyle(fontSize: 12, color: Colors.white70)),
            currentAccountPicture: const CompliNowMark(size: 56),
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
                if (perms.canView('corrective_actions'))
                  _tile(context, Icons.warning_amber_outlined, 'Corrective Actions', '/corrective-actions'),
                if (perms.canView('announcements'))
                  _tile(context, Icons.campaign_outlined, 'Announcements', '/announcements'),
                _tile(context, Icons.notifications_outlined, 'Notifications', '/notifications'),
                if (perms.canView('reports') || perms.canView('users') || perms.canView('roles')) ...[
                  const Divider(),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Text('ADMIN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey)),
                  ),
                  if (perms.canView('reports'))
                    _tile(context, Icons.bar_chart_outlined, 'Reports', '/admin/reports'),
                  if (perms.canView('users'))
                    _tile(context, Icons.people_outline, 'Users', '/admin/users'),
                  if (perms.canView('roles'))
                    _tile(context, Icons.admin_panel_settings_outlined, 'Roles & Permissions', '/admin/roles'),
                ],
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
      leading: Icon(icon, color: isActive ? kBrand : null),
      title: Text(label, style: TextStyle(
        fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
        color: isActive ? kBrand : null,
      )),
      selected: isActive,
      selectedTileColor: kBrand100,
      onTap: () { Navigator.pop(context); context.go(route); },
    );
  }
}
