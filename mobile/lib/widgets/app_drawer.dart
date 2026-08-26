import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../main.dart';
import '../theme.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final user = auth.user;

    return Drawer(
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(color: kBrand),
            accountName: Text(user?.fullName ?? ''),
            accountEmail: Text(user?.email ?? ''),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text(
                (user?.fullName.isNotEmpty == true) ? user!.fullName[0].toUpperCase() : 'U',
                style: const TextStyle(color: kBrand, fontWeight: FontWeight.bold, fontSize: 22),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _tile(context, Icons.dashboard_outlined, 'Dashboard', '/'),
                if (user?.canAudit == true) ...[
                  _tile(context, Icons.search_outlined, 'Inspections', '/inspections'),
                  _tile(context, Icons.shield_outlined, 'Audits', '/audits'),
                ],
                _tile(context, Icons.workspace_premium_outlined, 'Certifications', '/certifications'),
                _tile(context, Icons.warning_amber_outlined, 'Corrective Actions', '/corrective-actions'),
                _tile(context, Icons.campaign_outlined, 'Announcements', '/announcements'),
                _tile(context, Icons.notifications_outlined, 'Notifications', '/notifications'),
                if (user?.canManage == true) ...[
                  const Divider(),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Text('ADMIN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey)),
                  ),
                  _tile(context, Icons.local_hospital_outlined, 'Clinics', '/admin/clinics'),
                  _tile(context, Icons.bar_chart_outlined, 'Reports', '/admin/reports'),
                  if (user?.isAdmin == true)
                    _tile(context, Icons.people_outline, 'Users', '/admin/users'),
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
      title: Text(label, style: TextStyle(fontWeight: isActive ? FontWeight.w600 : FontWeight.normal, color: isActive ? kBrand : null)),
      selected: isActive,
      selectedTileColor: kBrand100,
      onTap: () { Navigator.pop(context); context.go(route); },
    );
  }
}
