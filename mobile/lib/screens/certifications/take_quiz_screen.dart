import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class TakeQuizScreen extends StatefulWidget {
  final String token;
  const TakeQuizScreen({super.key, required this.token});
  @override
  State<TakeQuizScreen> createState() => _TakeQuizScreenState();
}

class _TakeQuizScreenState extends State<TakeQuizScreen> {
  Map<String, dynamic>? _linkData;
  bool _loading = true;
  final Map<String, String> _answers = {};
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  bool _submitting = false;
  Map<String, dynamic>? _result;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _nameCtrl.dispose(); _emailCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/certifications/take/${widget.token}');
      if (mounted) {
        setState(() { _linkData = data; _loading = false; });
        _nameCtrl.text = data['assigned_name'] ?? '';
        _emailCtrl.text = data['assigned_email'] ?? '';
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.isEmpty || _emailCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your name and email')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final res = await ApiService().post('/certifications/take/${widget.token}/submit', {
        'answers': _answers,
        'participant_name': _nameCtrl.text,
        'participant_email': _emailCtrl.text,
      });
      if (mounted) setState(() { _result = res; _submitting = false; });
    } catch (e) {
      if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger)); setState(() => _submitting = false); }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_linkData == null) return const Scaffold(body: Center(child: Text('Invalid or expired link')));
    if (_result != null) return _resultScreen();

    final quizzes = (_linkData!['quizzes'] as List? ?? []);
    final allQuestions = quizzes.expand((qz) => (qz['questions'] as List? ?? [])).toList();

    return Scaffold(
      appBar: AppBar(title: Text(_linkData!['course_title'] ?? 'Quiz')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Your Full Name *')),
                const SizedBox(height: 12),
                TextField(controller: _emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Your Email *')),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          ...allQuestions.asMap().entries.map((entry) {
            final i = entry.key;
            final q = entry.value as Map<String, dynamic>;
            final qId = q['id'].toString();
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Q${i + 1}. ${q['question_text']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 10),
                  ...(q['options'] as List? ?? []).map((opt) {
                    final optId = opt['id'].toString();
                    final selected = _answers[qId] == optId;
                    return GestureDetector(
                      onTap: () => setState(() => _answers[qId] = optId),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: selected ? kBrand.withOpacity(0.1) : Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: selected ? kBrand : Colors.grey.shade200, width: 1.5),
                        ),
                        child: Row(children: [
                          Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked, size: 18, color: selected ? kBrand : Colors.grey),
                          const SizedBox(width: 10),
                          Expanded(child: Text(opt['option_text'], style: TextStyle(color: selected ? kBrand : null, fontWeight: selected ? FontWeight.w600 : null))),
                        ]),
                      ),
                    );
                  }),
                ]),
              ),
            );
          }),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Submit Quiz'),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _resultScreen() {
    final passed = _result!['status'] == 'completed';
    final score = (_result!['score'] as num?)?.toStringAsFixed(1) ?? '0';
    return Scaffold(
      appBar: AppBar(title: const Text('Quiz Result')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(passed ? Icons.check_circle : Icons.cancel, size: 80, color: passed ? kSuccess : kDanger),
            const SizedBox(height: 20),
            Text(passed ? 'Congratulations!' : 'Better luck next time', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Text('Your Score: $score%', style: const TextStyle(fontSize: 18, color: Colors.grey)),
            if (passed) ...[
              const SizedBox(height: 20),
              const Text('Your certificate has been generated.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
            ],
          ]),
        ),
      ),
    );
  }
}
