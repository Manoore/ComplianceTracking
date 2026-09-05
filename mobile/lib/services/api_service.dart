import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

const String kBaseUrl = 'https://compliancetracking.onrender.com/api';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  final _storage = const FlutterSecureStorage();

  Future<String?> getToken() => _storage.read(key: 'access_token');
  Future<String?> getRefreshToken() => _storage.read(key: 'refresh_token');

  Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: 'access_token', value: access);
    await _storage.write(key: 'refresh_token', value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.deleteAll();
  }

  Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<http.Response> _withRefresh(Future<http.Response> Function() call) async {
    var res = await call();
    if (res.statusCode == 401) {
      final refreshToken = await getRefreshToken();
      if (refreshToken != null) {
        final refreshRes = await http.post(
          Uri.parse('$kBaseUrl/auth/refresh'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refresh_token': refreshToken}),
        );
        if (refreshRes.statusCode == 200) {
          final data = jsonDecode(refreshRes.body);
          await saveTokens(data['access_token'], data['refresh_token']);
          res = await call();
        } else {
          await clearTokens();
          throw UnauthorizedException();
        }
      } else {
        await clearTokens();
        throw UnauthorizedException();
      }
    }
    return res;
  }

  Future<dynamic> get(String path) async {
    final headers = await _headers();
    final res = await _withRefresh(() => http.get(Uri.parse('$kBaseUrl$path'), headers: headers));
    _checkStatus(res);
    return jsonDecode(res.body);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final res = await _withRefresh(() => http.post(
          Uri.parse('$kBaseUrl$path'),
          headers: headers,
          body: jsonEncode(body),
        ));
    _checkStatus(res);
    return jsonDecode(res.body);
  }

  Future<dynamic> put(String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final res = await _withRefresh(() => http.put(
          Uri.parse('$kBaseUrl$path'),
          headers: headers,
          body: jsonEncode(body),
        ));
    _checkStatus(res);
    return jsonDecode(res.body);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final res = await _withRefresh(() => http.patch(
          Uri.parse('$kBaseUrl$path'),
          headers: headers,
          body: jsonEncode(body),
        ));
    _checkStatus(res);
    return jsonDecode(res.body);
  }

  Future<void> delete(String path, {Map<String, dynamic>? body}) async {
    final headers = await _headers();
    final res = await _withRefresh(() => http.delete(
      Uri.parse('$kBaseUrl$path'),
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    ));
    if (res.statusCode >= 400) _checkStatus(res);
  }

  void _checkStatus(http.Response res) {
    if (res.statusCode >= 400) {
      String msg = 'Request failed';
      try {
        final body = jsonDecode(res.body);
        final detail = body['detail'];
        if (detail is String) msg = detail;
        if (detail is List) msg = detail.map((d) => d['msg'] ?? d.toString()).join(', ');
      } catch (_) {}
      throw ApiException(msg, res.statusCode);
    }
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);
  @override
  String toString() => message;
}

class UnauthorizedException implements Exception {}
