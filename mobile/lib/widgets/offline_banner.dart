import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';

/// Shows a persistent amber banner when the device has no internet connection.
/// Checks connectivity by attempting a DNS lookup to the backend host.
class OfflineBanner extends StatefulWidget {
  const OfflineBanner({super.key});
  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  bool _offline = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _check();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _check());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _check() async {
    try {
      final result = await InternetAddress.lookup('compliancetracking.onrender.com')
          .timeout(const Duration(seconds: 5));
      if (mounted) setState(() => _offline = result.isEmpty || result.first.rawAddress.isEmpty);
    } catch (_) {
      if (mounted) setState(() => _offline = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_offline) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: Colors.amber.shade700,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: const Row(children: [
        Icon(Icons.wifi_off_outlined, color: Colors.white, size: 18),
        SizedBox(width: 8),
        Expanded(child: Text(
          'No internet connection — some features unavailable',
          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
        )),
      ]),
    );
  }
}
