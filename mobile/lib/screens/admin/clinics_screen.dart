import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/app_drawer.dart';

const kServiceOptions = ['Urgent Care', 'Primary Care', 'Clinical Research', 'Wellness'];

const kClinicTypes = <String, String>{
  'general_practice': 'General Practice',
  'urgent_care': 'Urgent Care',
  'dental': 'Dental',
  'lab': 'Lab',
  'pharmacy': 'Pharmacy',
  'specialist': 'Specialist',
  'mental_health': 'Mental Health',
  'physical_therapy': 'Physical Therapy',
  'radiology': 'Radiology',
  'other': 'Other',
};

const kUnassignedRegion = 'Unassigned';

class ClinicsScreen extends StatefulWidget {
  const ClinicsScreen({super.key});
  @override
  State<ClinicsScreen> createState() => _ClinicsScreenState();
}

class _ClinicsScreenState extends State<ClinicsScreen> {
  List<Clinic> _clinics = [];
  bool _loading = true;
  String _search = '';
  String _regionFilter = '';
  final Set<String> _collapsed = {};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/clinics') as List;
      if (mounted) setState(() { _clinics = data.map((e) => Clinic.fromJson(e)).toList(); _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  List<Clinic> get _filtered {
    var list = _clinics;
    if (_regionFilter.isNotEmpty) {
      list = list.where((c) => (c.region ?? kUnassignedRegion) == _regionFilter).toList();
    }
    if (_search.isEmpty) return list;
    final q = _search.toLowerCase();
    return list.where((c) =>
        c.name.toLowerCase().contains(q) ||
        c.fullAddress.toLowerCase().contains(q) ||
        (c.region?.toLowerCase().contains(q) ?? false) ||
        c.services.any((s) => s.toLowerCase().contains(q))).toList();
  }

  /// Regions in display order — named regions alphabetically, "Unassigned" last.
  List<String> get _allRegions {
    final set = _clinics.map((c) => c.region ?? kUnassignedRegion).toSet().toList();
    set.sort((a, b) {
      if (a == kUnassignedRegion) return 1;
      if (b == kUnassignedRegion) return -1;
      return a.compareTo(b);
    });
    return set;
  }

  Map<String, List<Clinic>> get _grouped {
    final map = <String, List<Clinic>>{};
    for (final c in _filtered) {
      map.putIfAbsent(c.region ?? kUnassignedRegion, () => []).add(c);
    }
    for (final list in map.values) {
      list.sort((a, b) => a.name.compareTo(b.name));
    }
    return map;
  }

  Color _scoreColor(double? score) {
    if (score == null) return Colors.grey;
    if (score >= 80) return kSuccess;
    if (score >= 60) return kWarning;
    return kDanger;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final canManage = auth.user?.canManage ?? false;
    final grouped = _grouped;
    final regions = _allRegions;
    final orderedKeys = regions.where(grouped.containsKey).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Clinics'),
        actions: [
          if (_clinics.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(child: Text('${_filtered.length} of ${_clinics.length}',
                  style: const TextStyle(color: Colors.white70, fontSize: 12))),
            ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: canManage ? FloatingActionButton(
        backgroundColor: kBrand,
        child: const Icon(Icons.add, color: Colors.white),
        onPressed: () => _openForm(null),
      ) : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search name, address, region, service…',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          if (regions.length > 1)
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _regionChip('All Regions', '', _clinics.length),
                  ...regions.map((r) => _regionChip(
                        r, r, _clinics.where((c) => (c.region ?? kUnassignedRegion) == r).length)),
                ],
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : orderedKeys.isEmpty
                      ? const Center(child: Text('No clinics found', style: TextStyle(color: Colors.grey)))
                      : ListView(
                          padding: const EdgeInsets.only(bottom: 80),
                          children: [
                            for (final region in orderedKeys) ...[
                              _regionHeader(region, grouped[region]!.length),
                              if (!_collapsed.contains(region))
                                ...grouped[region]!.map((c) => _clinicCard(c, canManage)),
                            ],
                          ],
                        ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _regionChip(String label, String value, int count) {
    final selected = _regionFilter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text('$label ($count)'),
        selected: selected,
        onSelected: (_) => setState(() => _regionFilter = value),
        selectedColor: kBrand100,
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          color: selected ? kBrand : null,
        ),
      ),
    );
  }

  Widget _regionHeader(String region, int count) {
    final collapsed = _collapsed.contains(region);
    return InkWell(
      onTap: () => setState(() {
        if (collapsed) {
          _collapsed.remove(region);
        } else {
          _collapsed.add(region);
        }
      }),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
        child: Row(
          children: [
            Icon(collapsed ? Icons.expand_more : Icons.expand_less, color: kBrand, size: 22),
            const SizedBox(width: 6),
            Text(region, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: kBrand)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: kBrand100, borderRadius: BorderRadius.circular(12)),
              child: Text('$count ${count == 1 ? 'clinic' : 'clinics'}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kBrand)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _clinicCard(Clinic c, bool canManage) {
    final scoreColor = _scoreColor(c.complianceScore);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: canManage ? () => _openForm(c) : null,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CircleAvatar(
                backgroundColor: kBrand.withValues(alpha: 0.1),
                child: const Icon(Icons.local_hospital_outlined, color: kBrand),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                if (c.fullAddress.isNotEmpty)
                  Text(c.fullAddress, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                if (c.phone != null && c.phone!.isNotEmpty)
                  Text(c.phone!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                statusBadge(c.isActive ? 'active' : 'inactive'),
                if (c.complianceScore != null) ...[
                  const SizedBox(height: 4),
                  Text('${c.complianceScore!.toStringAsFixed(1)}%',
                    style: TextStyle(fontWeight: FontWeight.bold, color: scoreColor, fontSize: 15)),
                ],
              ]),
            ]),
            if (c.services.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, children: c.services.map(_serviceTag).toList()),
            ],
            if (c.complianceScore != null) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: c.complianceScore! / 100,
                  backgroundColor: Colors.grey.shade200,
                  color: scoreColor,
                  minHeight: 6,
                ),
              ),
            ],
            if (canManage) ...[
              const SizedBox(height: 10),
              Row(children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.edit_outlined, size: 14),
                  label: const Text('Edit'),
                  style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6)),
                  onPressed: () => _openForm(c),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  icon: Icon(c.isActive ? Icons.block_outlined : Icons.check_circle_outline, size: 14, color: c.isActive ? kDanger : kSuccess),
                  label: Text(c.isActive ? 'Deactivate' : 'Activate', style: TextStyle(color: c.isActive ? kDanger : kSuccess)),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: c.isActive ? kDanger : kSuccess),
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  ),
                  onPressed: () => _toggleActive(c),
                ),
              ]),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _serviceTag(String s) {
    final color = switch (s) {
      'Urgent Care' => kDanger,
      'Clinical Research' => kBrand,
      'Wellness' => kWarning,
      _ => kTeal,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(s, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }

  Future<void> _toggleActive(Clinic c) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(c.isActive ? 'Deactivate Clinic?' : 'Activate Clinic?'),
        content: Text(c.isActive
            ? 'Deactivating ${c.name} will hide it from active views.'
            : 'Reactivating ${c.name} will make it visible again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true),
            child: Text(c.isActive ? 'Deactivate' : 'Activate',
              style: TextStyle(color: c.isActive ? kDanger : kSuccess))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService().put('/clinics/${c.id}', {'name': c.name, 'is_active': !c.isActive});
      _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(c.isActive ? '${c.name} deactivated' : '${c.name} activated'), backgroundColor: kSuccess));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: kDanger));
    }
  }

  Future<void> _openForm(Clinic? existing) async {
    final knownRegions = _allRegions.where((r) => r != kUnassignedRegion).toList();
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ClinicFormSheet(existing: existing, knownRegions: knownRegions),
    );
    if (saved == true) {
      _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(existing == null ? 'Clinic added' : 'Clinic updated'),
        backgroundColor: kSuccess));
    }
  }
}

/// Full clinic editor. Every stored detail is editable here.
class _ClinicFormSheet extends StatefulWidget {
  final Clinic? existing;
  final List<String> knownRegions;
  const _ClinicFormSheet({this.existing, required this.knownRegions});

  @override
  State<_ClinicFormSheet> createState() => _ClinicFormSheetState();
}

class _ClinicFormSheetState extends State<_ClinicFormSheet> {
  late final Map<String, TextEditingController> _ctrls;
  late String _clinicType;
  late String _region;
  late Set<String> _services;
  bool _newRegion = false;
  bool _saving = false;
  String? _error;

  static const _newRegionSentinel = '__new__';

  @override
  void initState() {
    super.initState();
    final c = widget.existing;
    _ctrls = {
      for (final f in ['name', 'address', 'city', 'state', 'zip_code', 'phone',
                       'email', 'website', 'license_number', 'notes', 'region_new'])
        f: TextEditingController(),
    };
    _ctrls['name']!.text = c?.name ?? '';
    _ctrls['address']!.text = c?.address ?? '';
    _ctrls['city']!.text = c?.city ?? '';
    _ctrls['state']!.text = c?.state ?? '';
    _ctrls['zip_code']!.text = c?.zipCode ?? '';
    _ctrls['phone']!.text = c?.phone ?? '';
    _ctrls['email']!.text = c?.email ?? '';
    _ctrls['website']!.text = c?.website ?? '';
    _ctrls['license_number']!.text = c?.licenseNumber ?? '';
    _ctrls['notes']!.text = c?.notes ?? '';
    _clinicType = c?.clinicType ?? 'general_practice';
    _services = c?.services.toSet() ?? <String>{};
    final r = c?.region;
    if (r != null && r.isNotEmpty && widget.knownRegions.contains(r)) {
      _region = r;
    } else if (r != null && r.isNotEmpty) {
      _region = _newRegionSentinel;
      _newRegion = true;
      _ctrls['region_new']!.text = r;
    } else {
      _region = '';
    }
  }

  @override
  void dispose() {
    for (final c in _ctrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  String get _resolvedRegion =>
      _newRegion ? _ctrls['region_new']!.text.trim() : (_region == _newRegionSentinel ? '' : _region);

  Future<void> _save() async {
    final name = _ctrls['name']!.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Clinic name is required');
      return;
    }
    setState(() { _saving = true; _error = null; });
    // Every field is sent, so clearing one persists the clear.
    final body = <String, dynamic>{
      'name': name,
      'clinic_type': _clinicType,
      'services': _services.toList(),
      'address': _ctrls['address']!.text.trim(),
      'city': _ctrls['city']!.text.trim(),
      'state': _ctrls['state']!.text.trim(),
      'zip_code': _ctrls['zip_code']!.text.trim(),
      'region': _resolvedRegion,
      'phone': _ctrls['phone']!.text.trim(),
      'email': _ctrls['email']!.text.trim(),
      'website': _ctrls['website']!.text.trim(),
      'license_number': _ctrls['license_number']!.text.trim(),
      'notes': _ctrls['notes']!.text.trim(),
    };
    try {
      if (widget.existing == null) {
        await ApiService().post('/clinics', body);
      } else {
        await ApiService().put('/clinics/${widget.existing!.id}', body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _saving = false; _error = e.toString(); });
    }
  }

  Widget _field(String key, String label, {TextInputType? type, int maxLines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: _ctrls[key],
          keyboardType: type,
          maxLines: maxLines,
          decoration: InputDecoration(labelText: label, isDense: true),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.existing == null ? 'Add Clinic' : 'Edit Clinic',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 16),

          _field('name', 'Clinic Name *'),

          // Region
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: DropdownButtonFormField<String>(
              initialValue: _newRegion ? _newRegionSentinel : (_region.isEmpty ? null : _region),
              decoration: const InputDecoration(labelText: 'Region', isDense: true),
              hint: const Text('— Unassigned —'),
              items: [
                ...widget.knownRegions.map((r) => DropdownMenuItem(value: r, child: Text(r))),
                const DropdownMenuItem(value: _newRegionSentinel, child: Text('+ New region…')),
              ],
              onChanged: (v) => setState(() {
                _newRegion = v == _newRegionSentinel;
                _region = v ?? '';
              }),
            ),
          ),
          if (_newRegion) _field('region_new', 'New Region Name'),

          // Clinic type
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: DropdownButtonFormField<String>(
              initialValue: _clinicType,
              decoration: const InputDecoration(labelText: 'Clinic Type', isDense: true),
              items: kClinicTypes.entries
                  .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) => setState(() => _clinicType = v ?? 'general_practice'),
            ),
          ),

          // Services
          const Text('Services', style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 6),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final s in {...kServiceOptions, ..._services})
              FilterChip(
                label: Text(s, style: const TextStyle(fontSize: 12)),
                selected: _services.contains(s),
                selectedColor: kBrand100,
                checkmarkColor: kBrand,
                onSelected: (on) => setState(() => on ? _services.add(s) : _services.remove(s)),
              ),
          ]),
          const SizedBox(height: 16),

          _field('address', 'Address'),
          Row(children: [
            Expanded(flex: 2, child: _field('city', 'City')),
            const SizedBox(width: 10),
            Expanded(child: _field('state', 'State')),
            const SizedBox(width: 10),
            Expanded(child: _field('zip_code', 'ZIP')),
          ]),
          _field('phone', 'Phone', type: TextInputType.phone),
          _field('email', 'Email', type: TextInputType.emailAddress),
          _field('website', 'Website', type: TextInputType.url),
          _field('license_number', 'License Number'),
          _field('notes', 'Notes', maxLines: 3),

          if (_error != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: kDanger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
              child: Text(_error!, style: const TextStyle(color: kDanger, fontSize: 13)),
            ),
            const SizedBox(height: 12),
          ],

          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(widget.existing == null ? 'Add Clinic' : 'Save Changes'),
          )),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}
