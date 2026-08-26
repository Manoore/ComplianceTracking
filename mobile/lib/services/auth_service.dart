import 'api_service.dart';

class AuthUser {
  final int id;
  final String email;
  final String fullName;
  final String role;
  final bool isActive;

  AuthUser({required this.id, required this.email, required this.fullName, required this.role, required this.isActive});

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'],
        email: j['email'],
        fullName: j['full_name'],
        role: j['role'],
        isActive: j['is_active'] ?? true,
      );

  bool get isAdmin => role == 'admin';
  bool get isManager => role == 'manager';
  bool get isAuditor => role == 'auditor';
  bool get canManage => isAdmin || isManager;
  bool get canAudit => isAdmin || isManager || isAuditor;
}

class AuthService {
  static final AuthService _instance = AuthService._();
  factory AuthService() => _instance;
  AuthService._();

  final _api = ApiService();
  AuthUser? _currentUser;
  AuthUser? get currentUser => _currentUser;

  Future<AuthUser> login(String email, String password) async {
    final data = await _api.post('/auth/login', {'email': email, 'password': password});
    await _api.saveTokens(data['access_token'], data['refresh_token']);
    final me = await _api.get('/auth/me');
    _currentUser = AuthUser.fromJson(me);
    return _currentUser!;
  }

  Future<AuthUser?> tryAutoLogin() async {
    final token = await _api.getToken();
    if (token == null) return null;
    try {
      final me = await _api.get('/auth/me');
      _currentUser = AuthUser.fromJson(me);
      return _currentUser;
    } catch (_) {
      await _api.clearTokens();
      return null;
    }
  }

  Future<void> logout() async {
    _currentUser = null;
    await _api.clearTokens();
  }
}
