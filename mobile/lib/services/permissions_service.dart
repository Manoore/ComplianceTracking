import 'package:flutter/foundation.dart';
import 'api_service.dart';

const _fallback = {
  'admin': ['dashboard', 'clinics', 'checklists', 'inspections', 'audits',
            'certifications', 'corrective_actions', 'announcements', 'reports', 'users', 'roles'],
  'manager': ['dashboard', 'clinics', 'inspections', 'audits', 'certifications', 'corrective_actions', 'announcements'],
  'auditor': ['dashboard', 'clinics', 'inspections', 'audits', 'certifications', 'corrective_actions', 'announcements', 'reports'],
  'team_member': ['dashboard', 'inspections', 'certifications', 'corrective_actions', 'announcements'],
};

class PermissionsService extends ChangeNotifier {
  final _api = ApiService();
  List<String> _modules = [];
  bool _loaded = false;

  bool get loaded => _loaded;
  bool canView(String module) => _loaded && _modules.contains(module);

  Future<void> load(String role) async {
    try {
      final data = await _api.get('/roles/my-permissions') as Map<String, dynamic>;
      _modules = List<String>.from(data['modules'] ?? []);
    } catch (_) {
      _modules = List<String>.from(_fallback[role] ?? ['dashboard']);
    }
    _loaded = true;
    notifyListeners();
  }

  void reset() {
    _modules = [];
    _loaded = false;
    notifyListeners();
  }
}
