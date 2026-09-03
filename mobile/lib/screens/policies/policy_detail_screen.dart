import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class PolicyDetailScreen extends StatefulWidget {
  final int id;
  const PolicyDetailScreen({super.key, required this.id});
  @override
  State<PolicyDetailScreen> createState() => _PolicyDetailScreenState();
}

class _PolicyDetailScreenState extends State<PolicyDetailScreen> {
  Map<String, dynamic>? _policy;
  bool _loading = true;
  bool _signing = false;

  // Quiz state
  bool _showQuiz = false;
  List<int?> _selectedAnswers = [];
  Map<String, dynamic>? _quizResult;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/policies/${widget.id}');
      if (mounted) {
        final questions = (data['quiz_questions'] as List?) ?? [];
        setState(() {
          _policy = data;
          _loading = false;
          _selectedAnswers = List.filled(questions.length, null);
        });
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _acknowledge() async {
    setState(() => _signing = true);
    try {
      await ApiService().post('/policies/${widget.id}/acknowledge', {});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Policy acknowledged!'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    } finally {
      if (mounted) setState(() => _signing = false);
    }
  }

  Future<void> _submitQuiz() async {
    if (_selectedAnswers.any((a) => a == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please answer all questions'), backgroundColor: kWarning));
      return;
    }
    setState(() => _signing = true);
    try {
      final result = await ApiService().post('/policies/${widget.id}/acknowledge', {
        'quiz_answers': _selectedAnswers,
      });
      setState(() { _quizResult = result; });
      await _load();
      if (mounted && result['status'] == 'signed') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Quiz passed! Score: ${result['score']?.toStringAsFixed(0)}%'), backgroundColor: kSuccess));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    } finally {
      if (mounted) setState(() => _signing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_policy == null) return const Scaffold(body: Center(child: Text('Policy not found')));

    final p = _policy!;
    final att = p['my_attestation'] as Map?;
    final isSigned = att?['status'] == 'signed';
    final requiresQuiz = p['requires_quiz'] == true;
    final questions = (p['quiz_questions'] as List?) ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Text(p['title'] ?? '', overflow: TextOverflow.ellipsis),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(child: Text('v${p['version'] ?? '1.0'}', style: const TextStyle(color: Colors.white70, fontSize: 13))),
          ),
        ],
      ),
      body: Column(
        children: [
          if (isSigned)
            Container(
              color: kSuccess.withOpacity(0.1),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(children: [
                const Icon(Icons.check_circle, color: kSuccess, size: 18),
                const SizedBox(width: 8),
                Text('Acknowledged on ${att!['signed_at']?.toString().substring(0, 10) ?? ''}',
                  style: const TextStyle(color: kSuccess, fontWeight: FontWeight.w600, fontSize: 13)),
              ]),
            ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (p['category'] != null || p['effective_date'] != null)
                  Wrap(spacing: 8, runSpacing: 4, children: [
                    if (p['category'] != null)
                      _chip(p['category'], Colors.blue),
                    if (p['effective_date'] != null)
                      _chip('Effective ${p['effective_date'].toString().substring(0, 10)}', Colors.grey),
                    if (requiresQuiz)
                      _chip('Quiz Required', Colors.orange),
                  ]),
                const SizedBox(height: 16),
                if (p['description'] != null) ...[
                  Text(p['description'], style: const TextStyle(color: Colors.grey, fontStyle: FontStyle.italic)),
                  const SizedBox(height: 16),
                ],
                const Divider(),
                const SizedBox(height: 8),
                Text(p['content'] ?? '', style: const TextStyle(fontSize: 14, height: 1.6)),
                const SizedBox(height: 32),

                // Quiz section
                if (requiresQuiz && _showQuiz && questions.isNotEmpty) ...[
                  const Divider(),
                  const SizedBox(height: 8),
                  const Text('Knowledge Check', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
                  const SizedBox(height: 4),
                  Text('Pass threshold: ${p['pass_threshold'] ?? 80}%',
                    style: const TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(height: 16),
                  ...List.generate(questions.length, (qi) {
                    final q = questions[qi] as Map;
                    final opts = (q['options'] as List?) ?? [];
                    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${qi + 1}. ${q['question']}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      const SizedBox(height: 8),
                      ...List.generate(opts.length, (oi) => RadioListTile<int>(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        value: oi,
                        groupValue: _selectedAnswers[qi],
                        title: Text(opts[oi].toString(), style: const TextStyle(fontSize: 14)),
                        onChanged: isSigned ? null : (v) => setState(() => _selectedAnswers[qi] = v),
                      )),
                      const SizedBox(height: 12),
                    ]);
                  }),

                  if (_quizResult != null && _quizResult!['status'] == 'quiz_failed')
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: kDanger.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
                      child: Row(children: [
                        const Icon(Icons.cancel_outlined, color: kDanger),
                        const SizedBox(width: 8),
                        Text('Score: ${_quizResult!['score']?.toStringAsFixed(0)}% — Need ${_quizResult!['pass_threshold']}% to pass',
                          style: const TextStyle(color: kDanger, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                ],

                const SizedBox(height: 24),
              ]),
            ),
          ),
          if (!isSigned) SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                if (requiresQuiz && !_showQuiz) ...[
                  SizedBox(width: double.infinity, child: ElevatedButton.icon(
                    icon: const Icon(Icons.quiz_outlined),
                    label: const Text('Take Knowledge Quiz'),
                    onPressed: () => setState(() => _showQuiz = true),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                  )),
                  const SizedBox(height: 8),
                ],
                if (requiresQuiz && _showQuiz)
                  SizedBox(width: double.infinity, child: ElevatedButton.icon(
                    icon: _signing ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send_outlined),
                    label: Text(_signing ? 'Submitting…' : 'Submit Quiz'),
                    onPressed: _signing ? null : _submitQuiz,
                  )),
                if (!requiresQuiz)
                  SizedBox(width: double.infinity, child: ElevatedButton.icon(
                    icon: _signing ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_circle_outline),
                    label: Text(_signing ? 'Signing…' : 'Acknowledge & Sign'),
                    onPressed: _signing ? null : _acknowledge,
                  )),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
    child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w500)),
  );
}
