import 'dart:async';
import 'package:flutter/material.dart';

/// Monitors user activity and triggers auto-logout after [timeoutDuration]
/// of inactivity. HIPAA best practice for healthcare apps.
class SessionService {
  static final SessionService _instance = SessionService._();
  factory SessionService() => _instance;
  SessionService._();

  static const Duration timeoutDuration = Duration(minutes: 15);

  Timer? _timer;
  VoidCallback? _onTimeout;

  void start(VoidCallback onTimeout) {
    _onTimeout = onTimeout;
    _resetTimer();
  }

  /// Call this on any user interaction (tap, scroll, type)
  void activity() => _resetTimer();

  void stop() {
    _timer?.cancel();
    _timer = null;
    _onTimeout = null;
  }

  void _resetTimer() {
    _timer?.cancel();
    _timer = Timer(timeoutDuration, () {
      _onTimeout?.call();
    });
  }
}

/// Wrap the root app widget with this to track user activity globally
class SessionActivityDetector extends StatefulWidget {
  final Widget child;
  final VoidCallback onTimeout;

  const SessionActivityDetector({
    super.key,
    required this.child,
    required this.onTimeout,
  });

  @override
  State<SessionActivityDetector> createState() => _SessionActivityDetectorState();
}

class _SessionActivityDetectorState extends State<SessionActivityDetector> {
  @override
  void initState() {
    super.initState();
    SessionService().start(widget.onTimeout);
  }

  @override
  void dispose() {
    SessionService().stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => SessionService().activity(),
      onPanDown: (_) => SessionService().activity(),
      onScaleStart: (_) => SessionService().activity(),
      child: widget.child,
    );
  }
}
