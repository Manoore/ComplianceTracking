import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
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
  final Map<int, bool> _flagged = {};
  final Map<int, TextEditingController> _flagNotes = {};
  bool _submitting = false;
  bool _isPriority = false;
  final _priorityNoteController = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() {
    _notes.values.forEach((c) => c.dispose());
    _flagNotes.values.forEach((c) => c.dispose());
    _priorityNoteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/inspections/${widget.id}');
      final insp = InspectionDetail.fromJson(data);
      if (mounted) {
        setState(() { _insp = insp; _loading = false; });
        for (final item in insp.items) {
          if (item.reviewerOnly) continue; // never editable by the MA, nothing to preload
          if (item.answer != null) _answers[item.id] = item.answer!;
          _notes[item.id] = TextEditingController(text: item.notes ?? '');
          _flagged[item.id] = item.maFlagged;
          _flagNotes[item.id] = TextEditingController(text: item.maFlagNote ?? '');
        }
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _saveAnswer(int itemId, String answer) async {
    setState(() => _answers[itemId] = answer);
    try {
      await ApiService().put('/inspections/${widget.id}/items/$itemId', {
        if (kAnswerToResult.containsKey(answer)) 'result': kAnswerToResult[answer],
        'notes': _notes[itemId]?.text ?? '',
      });
    } catch (_) {}
  }

  Future<void> _toggleFlag(int itemId) async {
    final next = !(_flagged[itemId] ?? false);
    setState(() => _flagged[itemId] = next);
    try {
      await ApiService().put('/inspections/${widget.id}/items/$itemId', {'flagged': next});
    } catch (_) {}
  }

  Future<void> _saveFlagNote(int itemId) async {
    try {
      await ApiService().put('/inspections/${widget.id}/items/$itemId', {'flag_note': _flagNotes[itemId]?.text ?? ''});
    } catch (_) {}
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ApiService().post('/inspections/${widget.id}/submit', {
        'is_priority': _isPriority,
        if (_priorityNoteController.text.trim().isNotEmpty) 'priority_note': _priorityNoteController.text.trim(),
      });
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
      final token = await ApiService().getToken();
      final uri = Uri.parse('$kBaseUrl/inspections/${widget.id}/items/$itemId/photos');
      final req = http.MultipartRequest('POST', uri);
      req.headers['Authorization'] = 'Bearer $token';
      req.files.add(http.MultipartFile.fromBytes('file', bytes, filename: 'photo_$itemId.jpg'));
      final resp = await req.send();
      if (resp.statusCode < 300) {
        await _load();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo uploaded'), backgroundColor: kSuccess));
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Upload failed'), backgroundColor: kDanger));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_insp == null) return const Scaffold(body: Center(child: Text('Inspection not found')));
    final insp = _insp!;
    // Backend creates inspections as 'in_progress', never 'draft' -- both are the MA's
    // editable fill-out window, before 'submitted' and later statuses lock it.
    final isDraft = insp.status == 'draft' || insp.status == 'in_progress';

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
              Text('${insp.items.where((i) => !i.reviewerOnly).length} items', style: const TextStyle(color: Colors.grey, fontSize: 13)),
            ]),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: insp.items.length,
              itemBuilder: (_, i) {
                final item = insp.items[i];
                // A long checklist (e.g. a site-visit audit) is unusable as one flat
                // list -- show a header whenever the section changes from the item above.
                final showHeader = item.sectionTitle != null &&
                    (i == 0 || insp.items[i - 1].sectionTitle != item.sectionTitle);
                final card = Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text('Q${i + 1}. ${item.question}', style: const TextStyle(fontWeight: FontWeight.w500))),
                        if (item.isRequired) Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: kDanger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
                          child: const Text('Required', style: TextStyle(color: kDanger, fontSize: 10)),
                        ),
                      ]),
                      const SizedBox(height: 10),
                      if (item.reviewerOnly)
                        _reviewerOnlyRow(item)
                      else if (isDraft) ...[
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
                        // MA/PCT flag on this item -- recorded now, but Clinic Lead/Regional
                        // Manager are only notified once the whole checklist is submitted.
                        InkWell(
                          onTap: () => _toggleFlag(item.id),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(children: [
                              Icon(Icons.flag, size: 14, color: (_flagged[item.id] ?? false) ? kDanger : Colors.grey),
                              const SizedBox(width: 6),
                              Text((_flagged[item.id] ?? false) ? 'Flagged' : 'Flag this item',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                                      color: (_flagged[item.id] ?? false) ? kDanger : Colors.grey)),
                            ]),
                          ),
                        ),
                        if (_flagged[item.id] ?? false) TextField(
                          controller: _flagNotes[item.id],
                          decoration: const InputDecoration(hintText: "What's the concern? (optional)", isDense: true),
                          style: const TextStyle(fontSize: 13),
                          onChanged: (_) {},
                          onSubmitted: (_) => _saveFlagNote(item.id),
                          onTapOutside: (_) => _saveFlagNote(item.id),
                        ),
                      ] else
                        Row(children: [
                          statusBadge(_answers[item.id] ?? item.answer ?? 'unanswered'),
                          if (item.notes != null) ...[const SizedBox(width: 8), Expanded(child: Text(item.notes!, style: const TextStyle(fontSize: 12, color: Colors.grey)))],
                        ]),
                      if (!item.reviewerOnly && item.answeredByName != null) Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text('Answered by ${item.answeredByName}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                      ),
                      if (!isDraft && !item.reviewerOnly && item.maFlagged) Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Icon(Icons.flag, size: 13, color: kDanger),
                          const SizedBox(width: 6),
                          Expanded(child: Text(
                            'Flagged by ${item.answeredByName ?? 'MA/PCT'}${item.maFlagNote != null ? ' — ${item.maFlagNote}' : ''}',
                            style: const TextStyle(fontSize: 12, color: kDanger),
                          )),
                        ]),
                      ),
                    ]),
                  ),
                );
                if (!showHeader) return card;
                return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(
                    padding: EdgeInsets.only(top: i == 0 ? 0 : 8, bottom: 6, left: 4),
                    child: Text(item.sectionTitle!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: kBrand)),
                  ),
                  card,
                ]);
              },
            ),
          ),
          if (isDraft) SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CheckboxListTile(
                  value: _isPriority,
                  onChanged: (v) => setState(() => _isPriority = v ?? false),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  dense: true,
                  title: const Text('Mark as priority for your Clinic Lead / Regional Manager', style: TextStyle(fontSize: 13)),
                  secondary: Icon(Icons.priority_high, size: 18, color: _isPriority ? kWarning : Colors.grey),
                ),
                if (_isPriority) Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: TextField(
                    controller: _priorityNoteController,
                    decoration: const InputDecoration(hintText: 'Why is this priority? (optional)', isDense: true),
                  ),
                ),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.send_outlined),
                    label: Text(_submitting ? 'Submitting…' : 'Submit Inspection'),
                    onPressed: _submitting ? null : _submit,
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _reviewerOnlyRow(ChecklistItem item) {
    if (item.secondSignerName != null) {
      final flagged = item.isFlagged;
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(flagged ? Icons.flag : Icons.groups_outlined, size: 16, color: flagged ? kDanger : kSuccess),
          const SizedBox(width: 6),
          Expanded(child: Text(
            'Reviewed by ${item.secondSignerName}${flagged ? ' — flagged for follow-up' : ''}',
            style: TextStyle(fontSize: 13, color: flagged ? kDanger : kSuccess),
          )),
        ]),
        if (item.reviewNotes != null) Padding(
          padding: const EdgeInsets.only(left: 22, top: 2),
          child: Text(item.reviewNotes!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ),
      ]);
    }
    if (item.canReviewerSign) {
      return InkWell(
        onTap: () => context.push('/pending-reviews'),
        child: Row(children: [
          const Icon(Icons.draw_outlined, size: 14, color: kBrand),
          const SizedBox(width: 6),
          const Expanded(child: Text(
            'Awaiting your review — sign it from your Pending Reviews queue',
            style: TextStyle(fontSize: 12, color: kBrand, fontWeight: FontWeight.w600),
          )),
        ]),
      );
    }
    return Row(children: [
      const Icon(Icons.groups_outlined, size: 14, color: Colors.grey),
      const SizedBox(width: 6),
      const Expanded(child: Text(
        'Reviewed by your Clinic Lead or Regional Manager after you submit',
        style: TextStyle(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic),
      )),
    ]);
  }

  Widget _answerBtn(int itemId, String ans) {
    final selected = _answers[itemId] == ans;
    final color = ans == 'yes' ? kSuccess : ans == 'no' ? kDanger : Colors.grey;
    return GestureDetector(
      onTap: () => _saveAnswer(itemId, ans),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.15) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? color : Colors.transparent, width: 1.5),
        ),
        child: Center(child: Text(ans.toUpperCase(), style: TextStyle(color: selected ? color : Colors.grey, fontWeight: FontWeight.bold, fontSize: 12))),
      ),
    );
  }
}
