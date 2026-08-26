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
      if (mounted) context.go('/inspections/${res['id']}');
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
            value: _clinicId,
            items: _clinics.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
            onChanged: (v) => setState(() => _clinicId = v),
          ),
          const SizedBox(height: 20),
          const Text('Checklist Template', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          DropdownButtonFormField<int>(
            decoration: const InputDecoration(hintText: 'Choose a template…'),
            value: _templateId,
            items: _templates.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
            onChanged: (v) => setState(() => _templateId = v),
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
