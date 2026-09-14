import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../services/permissions_service.dart';
import '../theme.dart' show kBrand;

class _NavTab {
  final IconData icon;
  final String label;
  final String route;
  final String? module; // null = always visible (no permission gate)
  const _NavTab(this.icon, this.label, this.route, this.module);
}

/// Quick-access bottom tab bar for the handful of screens people jump between
/// most, so they don't have to open the drawer for every navigation. Anything
/// not listed here (Reports, Users, Profile, ...) still lives in the drawer,
/// which "More" opens directly.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key});

  static const _tabs = [
    _NavTab(Icons.dashboard_outlined, 'Dashboard', '/', null),
    _NavTab(Icons.search_outlined, 'Inspections', '/inspections', 'inspections'),
    _NavTab(Icons.warning_amber_outlined, 'Actions', '/corrective-actions', 'corrective_actions'),
    _NavTab(Icons.workspace_premium_outlined, 'Certs', '/certifications', 'certifications'),
  ];

  @override
  Widget build(BuildContext context) {
    final perms = context.watch<PermissionsService>();
    final visibleTabs = _tabs.where((t) => t.module == null || perms.canView(t.module!)).toList();
    final current = GoRouterState.of(context).matchedLocation;

    var selectedIndex = visibleTabs.indexWhere(
      (t) => t.route == '/' ? current == '/' : current.startsWith(t.route),
    );
    final moreIndex = visibleTabs.length; // "More" is always the last item
    if (selectedIndex == -1) selectedIndex = moreIndex;

    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      selectedItemColor: kBrand,
      unselectedItemColor: Colors.grey,
      currentIndex: selectedIndex,
      onTap: (i) {
        if (i == moreIndex) {
          Scaffold.of(context).openDrawer();
        } else {
          context.go(visibleTabs[i].route);
        }
      },
      items: [
        ...visibleTabs.map((t) => BottomNavigationBarItem(icon: Icon(t.icon), label: t.label)),
        const BottomNavigationBarItem(icon: Icon(Icons.menu), label: 'More'),
      ],
    );
  }
}
