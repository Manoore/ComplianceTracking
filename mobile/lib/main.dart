import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'services/permissions_service.dart';
import 'theme.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/inspections/inspections_screen.dart';
import 'screens/inspections/inspection_detail_screen.dart';
import 'screens/inspections/new_inspection_screen.dart';
import 'screens/audits/audits_screen.dart';
import 'screens/audits/audit_detail_screen.dart';
import 'screens/certifications/certifications_screen.dart';
import 'screens/certifications/take_quiz_screen.dart';
import 'screens/corrective_actions/corrective_actions_screen.dart';
import 'screens/announcements/announcements_screen.dart';
import 'screens/notifications/notifications_screen.dart';
import 'screens/admin/users_screen.dart';
import 'screens/admin/clinics_screen.dart';
import 'screens/admin/reports_screen.dart';
import 'screens/admin/roles_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ComplianceTrackApp());
}

class AuthState extends ChangeNotifier {
  final _auth = AuthService();
  final permissions = PermissionsService();
  bool _loading = true;
  bool _loggedIn = false;

  bool get loading => _loading;
  bool get loggedIn => _loggedIn;
  AuthUser? get user => _auth.currentUser;

  AuthState() { _init(); }

  Future<void> _init() async {
    final user = await _auth.tryAutoLogin();
    _loggedIn = user != null;
    if (user != null) await permissions.load(user.effectiveRole);
    _loading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    try {
      await _auth.login(email, password);
      _loggedIn = true;
      await permissions.load(_auth.currentUser!.effectiveRole);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> logout() async {
    await _auth.logout();
    permissions.reset();
    _loggedIn = false;
    notifyListeners();
  }
}

class ComplianceTrackApp extends StatelessWidget {
  const ComplianceTrackApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthState(),
      child: Consumer<AuthState>(
        builder: (context, auth, _) {
          return ChangeNotifierProvider.value(
            value: auth.permissions,
            child: Builder(builder: (context) {
              final router = GoRouter(
                refreshListenable: auth,
                redirect: (context, state) {
                  if (auth.loading) return null;
                  final loggedIn = auth.loggedIn;
                  if (!loggedIn && state.matchedLocation != '/login') return '/login';
                  if (loggedIn && state.matchedLocation == '/login') return '/';
                  return null;
                },
                routes: [
                  GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
                  GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
                  GoRoute(path: '/inspections', builder: (_, __) => const InspectionsScreen()),
                  GoRoute(path: '/inspections/new', builder: (_, __) => const NewInspectionScreen()),
                  GoRoute(path: '/inspections/:id', builder: (_, s) => InspectionDetailScreen(id: int.parse(s.pathParameters['id']!))),
                  GoRoute(path: '/audits', builder: (_, __) => const AuditsScreen()),
                  GoRoute(path: '/audits/:id', builder: (_, s) => AuditDetailScreen(id: int.parse(s.pathParameters['id']!))),
                  GoRoute(path: '/certifications', builder: (_, __) => const CertificationsScreen()),
                  GoRoute(path: '/certifications/quiz/:token', builder: (_, s) => TakeQuizScreen(token: s.pathParameters['token']!)),
                  GoRoute(path: '/corrective-actions', builder: (_, __) => const CorrectiveActionsScreen()),
                  GoRoute(path: '/announcements', builder: (_, __) => const AnnouncementsScreen()),
                  GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
                  GoRoute(path: '/admin/users', builder: (_, __) => const UsersScreen()),
                  GoRoute(path: '/admin/clinics', builder: (_, __) => const ClinicsScreen()),
                  GoRoute(path: '/admin/reports', builder: (_, __) => const ReportsScreen()),
                  GoRoute(path: '/admin/roles', builder: (_, __) => const RolesScreen()),
                ],
              );
              return MaterialApp.router(
                title: 'ComplianceTrack',
                theme: appTheme(),
                routerConfig: router,
                debugShowCheckedModeBanner: false,
              );
            }),
          );
        },
      ),
    );
  }
}
