import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class NewInspectionScreen extends StatefulWidget {
  const NewInspectionScreen({super.key});

  @override
  State<NewInspectionScreen> createState() => _NewInspectionScreenState();
}

class _NewInspectionScreenState extends State<NewInspectionScreen> {
  List<Clinic> _clinics = [];
  List<ChecklistTemplate> _templates = [];
  int? _clinicId, _templateId;
  Position? _gps;
  bool _gpsLoading = false;
  bool _submitting = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final api = ApiService();
      final results = await Future.wait([api.get('/clinics'), api.get('/checklists')]);
      if (mounted) setState(() {
        _clinics = (results[0] as List).map((e) => Clinic.fromJson(e)).where((c) => c.isActive).toList();
        _templates = (results[1] as List).map((e) => ChecklistTemplate.fromJson(e)).toList();
      });
    } catch (_) {}
  }

  Future<void> _captureGPS() async {
    setState(() => _gpsLoading = true);
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.deniedForever) {
        if (mounted) _showErr('Location permanently denied. Enable in device Settings → App → Location.');
        return;
      }
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      if (mounted) setState(() => _gps = pos);
    } on LocationServiceDisabledException {
      if (mounted) _showErr('Location services are off. Turn them on in your device settings.');
    } catch (e) {
      if (mounted) _showErr('Could not get GPS: $e');
    } finally {
      if (mounted) setState(() => _gpsLoading = false);
    }
  }

  void _showErr(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: kDanger));

  Clinic? get _selectedClinic {
    if (_clinicId == null) return null;
    for (final c in _clinics) {
      if (c.id == _clinicId) return c;
    }
    return null;
  }

  /// Templates for the clinic's own department, plus department-less templates
  /// that apply everywhere. A clinic with no department sees every template.
  List<ChecklistTemplate> get _availableTemplates {
    final deptId = _selectedClinic?.departmentId;
    if (deptId == null) return _templates;
    return _templates.where((t) => t.departmentId == null || t.departmentId == deptId).toList();
  }

  Future<void> _submit() async {
    if (_clinicId == null || _templateId == null) return;
    setState(() => _submitting = true);
    try {
      final body = {
        'clinic_id': _clinicId!,
        'template_id': _templateId!,
        if (_gps != null) 'checkin_lat': _gps!.latitude,
        if (_gps != null) 'checkin_lng': _gps!.longitude,
      };
      final res = await ApiService().post('/inspections', body);
      // pushReplacement (not go, which would wipe the whole nav stack and leave no
      // way back) so the stale "New Inspection" form is swapped out for the detail
      // screen, while the Inspections list underneath stays poppable to.
      if (mounted) context.pushReplacement('/inspections/${res['id']}');
    } catch (e) {
      if (mounted) { _showErr(e.toString()); setState(() => _submitting = false); }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Inspection')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Select Clinic', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<int>(
            decoration: const InputDecoration(hintText: 'Choose a clinic…'),
            initialValue: _clinicId,
            items: _clinics.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
            onChanged: (v) => setState(() { _clinicId = v; _templateId = null; }),
          ),
          const SizedBox(height: 20),
          const Text('Checklist Template', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<int>(
            key: ValueKey(_clinicId),
            decoration: InputDecoration(hintText: _clinicId == null ? 'Choose a clinic first…' : 'Choose a template…'),
            initialValue: _templateId,
            items: _availableTemplates.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
            onChanged: _clinicId == null ? null : (v) => setState(() => _templateId = v),
          ),
          if (_clinicId != null && _availableTemplates.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('No templates available for this clinic\'s department yet.',
                  style: TextStyle(color: kDanger, fontSize: 12)),
            ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            icon: _gpsLoading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(_gps != null ? Icons.gps_fixed : Icons.gps_not_fixed),
            label: Text(_gpsLoading
                ? 'Getting location…'
                : _gps != null
                    ? 'GPS: ${_gps!.latitude.toStringAsFixed(4)}, ${_gps!.longitude.toStringAsFixed(4)} (±${_gps!.accuracy.toStringAsFixed(0)}m)'
                    : 'Capture GPS Location (Optional)'),
            onPressed: _gpsLoading ? null : _captureGPS,
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: (_clinicId == null || _templateId == null || _submitting) ? null : _submit,
            child: _submitting
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Start Inspection'),
          ),
        ],
      ),
    );
  }
}
