import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class InspectionDetailScreen extends StatefulWidget {
  final int id;
  const InspectionDetailScreen({super.key, required this.id});

  @override
  State<InspectionDetailScreen> createState() => _InspectionDetailScreenState();
}

class _InspectionDetailScreenState extends State<InspectionDetailScreen> {
  InspectionDetail? _insp;
  bool _loading = true;
  final Map<int, String> _answers = {};
  final Map<int, TextEditingController> _notes = {};
  bool _submitting = false;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _notes.values.forEach((c) => c.dispose()); super.dispose(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/inspections/${widget.id}');
      final insp = InspectionDetail.fromJson(data);
      if (mounted) {
        setState(() { _insp = insp; _loading = false; });
        for (final item in insp.items) {
          if (item.answer != null) _answers[item.id] = item.answer!;
          _notes[item.id] = TextEditingController(text: item.notes ?? '');
        }
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _saveAnswer(int itemId, String answer) async {
    setState(() => _answers[itemId] = answer);
    try {
      await ApiService().patch('/inspections/${widget.id}/items/$itemId', {'answer': answer, 'notes': _notes[itemId]?.text ?? ''});
    } catch (_) {}
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ApiService().post('/inspections/${widget.id}/submit', {});
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Inspection submitted!'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickPhoto(int itemId) async {
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
    if (img == null) return;
    try {
      final bytes = await img.readAsBytes();
      final uri = Uri.parse('${ApiService().toString()}/inspections/${widget.id}/items/$itemId/photo');
      // Upload via multipart
      final req = await ApiService().get('/inspections/${widget.id}'); // refresh
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo captured')));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_insp == null) return const Scaffold(body: Center(child: Text('Inspection not found')));
    final insp = _insp!;
    final isDraft = insp.status == 'draft';

    return Scaffold(
      appBar: AppBar(
        title: Text(insp.clinicName, overflow: TextOverflow.ellipsis),
        actions: [if (insp.complianceScore != null) Padding(
          padding: const EdgeInsets.only(right: 16),
          child: Center(child: Text('${insp.complianceScore!.toStringAsFixed(1)}%', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
        )],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.grey.shade50,
            child: Row(children: [
              statusBadge(insp.status),
              if (insp.riskLevel != null) ...[const SizedBox(width: 8), statusBadge(insp.riskLevel)],
              const Spacer(),
              Text('${insp.items.length} items', style: const TextStyle(color: Colors.grey, fontSize: 13)),
            ]),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: insp.items.length,
              itemBuilder: (_, i) {
                final item = insp.items[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text('Q${i + 1}. ${item.question}', style: const TextStyle(fontWeight: FontWeight.w500))),
                        if (item.isRequired) Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: kDanger.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                          child: const Text('Required', style: TextStyle(color: kDanger, fontSize: 10)),
                        ),
                      ]),
                      const SizedBox(height: 10),
                      if (isDraft) ...[
                        Row(children: [
                          for (final ans in ['yes', 'no', 'na']) ...[
                            Expanded(child: _answerBtn(item.id, ans)),
                            if (ans != 'na') const SizedBox(width: 8),
                          ],
                        ]),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _notes[item.id],
                          decoration: const InputDecoration(hintText: 'Notes (optional)', isDense: true),
                          onChanged: (_) => _saveAnswer(item.id, _answers[item.id] ?? ''),
                          maxLines: 2,
                        ),
                        TextButton.icon(
                          icon: const Icon(Icons.camera_alt_outlined, size: 16),
                          label: const Text('Add Photo'),
                          onPressed: () => _pickPhoto(item.id),
                        ),
                      ] else
                        Row(children: [
                          statusBadge(_answers[item.id] ?? item.answer ?? 'unanswered'),
                          if (item.notes != null) ...[const SizedBox(width: 8), Expanded(child: Text(item.notes!, style: const TextStyle(fontSize: 12, color: Colors.grey)))],
                        ]),
                    ]),
                  ),
                );
              },
            ),
          ),
          if (isDraft) SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.send_outlined),
                  label: Text(_submitting ? 'Submitting…' : 'Submit Inspection'),
                  onPressed: _submitting ? null : _submit,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _answerBtn(int itemId, String ans) {
    final selected = _answers[itemId] == ans;
    final color = ans == 'yes' ? kSuccess : ans == 'no' ? kDanger : Colors.grey;
    return GestureDetector(
      onTap: () => _saveAnswer(itemId, ans),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.15) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? color : Colors.transparent, width: 1.5),
        ),
        child: Center(child: Text(ans.toUpperCase(), style: TextStyle(color: selected ? color : Colors.grey, fontWeight: FontWeight.bold, fontSize: 12))),
      ),
    );
  }
}
