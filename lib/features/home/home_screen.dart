import 'package:flutter/material.dart';

import '../../core/paper.dart';
import '../../core/settings_controller.dart';
import '../../core/theme.dart';
import '../match/match_screen.dart';
import '../match/match_state.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.settings});

  final SettingsController settings;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _namePromptScheduled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_namePromptScheduled && widget.settings.playerName.isEmpty) {
      _namePromptScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showNameDialog(required: true);
      });
    }
  }

  void _start(GameMode mode) {
    widget.settings.setLastMode(mode == GameMode.local ? 'local' : 'solo');
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MatchScreen(mode: mode, settings: widget.settings),
      ),
    );
  }

  void _comingSoon(String title) {
    showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: NotebookPaper(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title.toUpperCase(),
                  style: Theme.of(context).textTheme.headlineLarge
                      ?.copyWith(color: AppColors.red),
                ),
                const SizedBox(height: 12),
                const Text(
                  'The class network is not open yet. Solo and local matches are ready to play now.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 19, color: AppColors.ink),
                ),
                const SizedBox(height: 22),
                InkButton(
                  label: 'GOT IT',
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.settings,
      builder: (context, _) {
        final size = MediaQuery.sizeOf(context);
        final wide = size.width >= 900;
        return Scaffold(
          body: Stack(
            fit: StackFit.expand,
            children: [
              Image.asset(
                wide ? Assets.classroomDim : Assets.classroomPortraitDim,
                fit: BoxFit.cover,
                alignment: Alignment.center,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x22000000), Color(0x77000000)],
                  ),
                ),
              ),
              SafeArea(
                child: Column(
                  children: [
                    _TopNav(
                      wide: wide,
                      onFriend: () => _comingSoon('Friend match'),
                      onInstant: () => _comingSoon('Instant match'),
                      onCommunity: () => _comingSoon('Community'),
                      onSettings: _showSettings,
                    ),
                    Expanded(
                      child: Center(
                        child: SingleChildScrollView(
                          padding: EdgeInsets.fromLTRB(
                            wide ? 36 : 12,
                            8,
                            wide ? 36 : 12,
                            24,
                          ),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1180),
                            child: NotebookPaper(
                              padding: EdgeInsets.fromLTRB(
                                wide ? 52 : 34,
                                24,
                                wide ? 36 : 18,
                                26,
                              ),
                              child: _NotebookContent(
                                wide: wide,
                                playerName: widget.settings.playerName,
                                wins: widget.settings.soloWins,
                                localScore: widget.settings.localScore,
                                onSolo: () => _start(GameMode.solo),
                                onLocal: () => _start(GameMode.local),
                                onFriend: () => _comingSoon('Friend match'),
                                onInstant: () => _comingSoon('Instant match'),
                                onEditName: () => _showNameDialog(),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 14,
                bottom: 12,
                child: SafeArea(
                  child: Row(
                    children: [
                      Image.asset(Assets.badge, width: wide ? 82 : 58),
                      const SizedBox(width: 8),
                      if (wide)
                        const Text(
                          'Pilot V5',
                          style: TextStyle(color: Colors.white70, fontSize: 18),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSettings() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => AnimatedBuilder(
        animation: widget.settings,
        builder: (context, _) => SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 540),
              child: NotebookPaper(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.settings_outlined,
                          color: AppColors.ink,
                          size: 30,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'SETTINGS',
                          style: Theme.of(context).textTheme.headlineLarge,
                        ),
                        const Spacer(),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                    SwitchListTile(
                      title: const Text('Music'),
                      value: widget.settings.music,
                      onChanged: widget.settings.setMusic,
                    ),
                    SwitchListTile(
                      title: const Text('Sound effects'),
                      value: widget.settings.sound,
                      onChanged: widget.settings.setSound,
                    ),
                    SwitchListTile(
                      title: const Text('Haptics'),
                      value: widget.settings.haptics,
                      onChanged: widget.settings.setHaptics,
                    ),
                    SwitchListTile(
                      title: const Text('Reduced motion'),
                      value: widget.settings.reducedMotion,
                      onChanged: widget.settings.setReducedMotion,
                    ),
                    const Divider(),
                    ListTile(
                      leading: const Icon(
                        Icons.restart_alt,
                        color: AppColors.red,
                      ),
                      title: const Text('Reset progress'),
                      subtitle: const Text(
                        'Clear solo wins and saved local score',
                      ),
                      onTap: () => _confirmReset(context),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showNameDialog({bool required = false}) async {
    final name = await showDialog<String>(
      context: context,
      barrierDismissible: !required,
      builder: (_) => _NameDialog(
        required: required,
        initialName: widget.settings.playerName,
      ),
    );
    if (name != null) await widget.settings.setPlayerName(name);
  }

  Future<void> _confirmReset(BuildContext sheetContext) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Reset all progress?'),
        content: const Text('This clears solo wins and the saved local match.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('CANCEL'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('RESET'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await widget.settings.resetProgress();
      if (sheetContext.mounted) Navigator.pop(sheetContext);
    }
  }
}

class _NameDialog extends StatefulWidget {
  const _NameDialog({required this.required, required this.initialName});

  final bool required;
  final String initialName;

  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialName);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      Navigator.pop(context, _controller.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !widget.required,
      child: Dialog(
        backgroundColor: Colors.transparent,
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: NotebookPaper(
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.required ? 'CLAIM YOUR SEAT' : 'CHANGE YOUR NAME',
                      style: Theme.of(context).textTheme.headlineLarge,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'What should we write on your desk?',
                      style: TextStyle(fontSize: 19, color: AppColors.ink),
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      key: const Key('player-name-field'),
                      controller: _controller,
                      autofocus: true,
                      textCapitalization: TextCapitalization.words,
                      maxLength: 18,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'YOUR NAME',
                        hintText: 'Akhlaq',
                        border: OutlineInputBorder(),
                        filled: true,
                        fillColor: Color(0xaaffffff),
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'Write your name first'
                          : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (!widget.required) ...[
                          Expanded(
                            child: InkButton(
                              label: 'CANCEL',
                              secondary: true,
                              onPressed: () => Navigator.pop(context),
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: InkButton(
                            label: widget.required
                                ? 'TAKE MY SEAT'
                                : 'SAVE NAME',
                            onPressed: _submit,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TopNav extends StatelessWidget {
  const _TopNav({
    required this.wide,
    required this.onFriend,
    required this.onInstant,
    required this.onCommunity,
    required this.onSettings,
  });

  final bool wide;
  final VoidCallback onFriend;
  final VoidCallback onInstant;
  final VoidCallback onCommunity;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    Widget pill(String label, VoidCallback action, {bool light = false}) =>
        Padding(
          padding: const EdgeInsets.only(left: 8),
          child: OutlinedButton(
            onPressed: action,
            style: OutlinedButton.styleFrom(
              backgroundColor: light ? AppColors.paper : Colors.black26,
              foregroundColor: light ? AppColors.ink : Colors.white,
              side: BorderSide(color: Colors.white.withValues(alpha: .28)),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
            ),
            child: Text(label, style: const TextStyle(fontSize: 16)),
          ),
        );
    return Padding(
      padding: const EdgeInsets.all(10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          if (wide) ...[
            pill('FRIEND', onFriend),
            pill('INSTANT', onInstant),
            pill('COMMUNITY', onCommunity),
          ],
          pill('SIGN IN', () => _notice(context), light: true),
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: IconButton.filledTonal(
              tooltip: 'Settings',
              onPressed: onSettings,
              style: IconButton.styleFrom(
                backgroundColor: Colors.black38,
                foregroundColor: Colors.white,
              ),
              icon: const Icon(Icons.menu_rounded),
            ),
          ),
        ],
      ),
    );
  }

  void _notice(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Accounts are coming after the first class tournament.'),
      ),
    );
  }
}

class _NotebookContent extends StatelessWidget {
  const _NotebookContent({
    required this.wide,
    required this.playerName,
    required this.wins,
    required this.localScore,
    required this.onSolo,
    required this.onLocal,
    required this.onFriend,
    required this.onInstant,
    required this.onEditName,
  });

  final bool wide;
  final String playerName;
  final int wins;
  final List<int>? localScore;
  final VoidCallback onSolo;
  final VoidCallback onLocal;
  final VoidCallback onFriend;
  final VoidCallback onInstant;
  final VoidCallback onEditName;

  @override
  Widget build(BuildContext context) {
    final left = _Journey(
      playerName: playerName,
      wins: wins,
      onSolo: onSolo,
      onEditName: onEditName,
    );
    final right = _Modes(
      localScore: localScore,
      onLocal: onLocal,
      onFriend: onFriend,
      onInstant: onInstant,
    );
    return Column(
      children: [
        Row(
          children: [
            Image.asset(Assets.logo, height: 38),
            const Spacer(),
            const Icon(Icons.settings_outlined, color: AppColors.ink, size: 29),
          ],
        ),
        const Divider(height: 20, color: AppColors.rule),
        if (wide)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 12, child: left),
              Container(
                width: 1,
                height: 590,
                margin: const EdgeInsets.symmetric(horizontal: 34),
                color: const Color(0x22000000),
              ),
              Expanded(flex: 9, child: right),
            ],
          )
        else ...[
          left,
          const SizedBox(height: 28),
          right,
        ],
        const SizedBox(height: 18),
        const Text(
          'made on the last bench  •  drag, aim, flick!',
          style: TextStyle(color: AppColors.inkSoft, fontSize: 14),
        ),
      ],
    );
  }
}

class _Journey extends StatelessWidget {
  const _Journey({
    required this.playerName,
    required this.wins,
    required this.onSolo,
    required this.onEditName,
  });

  final String playerName;
  final int wins;
  final VoidCallback onSolo;
  final VoidCallback onEditName;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          key: const Key('edit-player-name'),
          onTap: onEditName,
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.only(right: 8, bottom: 2),
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    playerName.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.displayLarge
                        ?.copyWith(fontSize: 42),
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.edit_outlined, color: AppColors.ink, size: 22),
              ],
            ),
          ),
        ),
        Text(
          '$wins of 12 pens · ${12 - wins} to the Trimax',
          style: const TextStyle(fontSize: 20, color: AppColors.ink),
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(
            12,
            (index) => Expanded(
              child: Container(
                height: 10,
                margin: const EdgeInsets.only(right: 7),
                decoration: BoxDecoration(
                  color: index < wins ? AppColors.ink : AppColors.paper,
                  border: Border.all(
                    color: index == wins ? AppColors.red : AppColors.inkSoft,
                  ),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 26),
        _SectionTitle(
          label: wins == 0 ? 'YOUR FIRST FIGHT' : 'YOUR NEXT FIGHT',
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .55),
            border: Border.all(color: const Color(0x33766a50)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x22000000),
                blurRadius: 12,
                offset: Offset(0, 7),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '9A  •  SOLO CHAMPIONSHIP',
                style: TextStyle(
                  color: AppColors.red,
                  fontFamily: 'Anton',
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                wins == 0 ? 'TAKE THE FRONT DESK' : 'SETTLE THE NEXT SCORE',
                style: Theme.of(context).textTheme.headlineLarge
                    ?.copyWith(fontSize: 32, color: AppColors.red),
              ),
              const SizedBox(height: 5),
              const Text(
                'Win three rounds before your rival sends your pen over the edge.',
                style: TextStyle(fontSize: 18, color: AppColors.ink),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.rule),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Image.asset(
                        Assets.goldPen,
                        height: 48,
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'THE PRIZE',
                          style: TextStyle(
                            color: AppColors.red,
                            fontFamily: 'Anton',
                          ),
                        ),
                        Text(
                          'GOLD NIB',
                          style: TextStyle(color: AppColors.ink, fontSize: 18),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: InkButton(
                  label: wins == 0 ? 'START SOLO' : 'CONTINUE JOURNEY',
                  onPressed: onSolo,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _LockedRow(
          code: '9B',
          title: 'OTHER CLASSES',
          subtitle: 'Beat your first rival to unlock',
        ),
        _LockedRow(
          code: 'CHEM',
          title: 'CHEMISTRY LAB',
          subtitle: 'A practical at the wet bench',
        ),
      ],
    );
  }
}

class _Modes extends StatelessWidget {
  const _Modes({
    required this.localScore,
    required this.onLocal,
    required this.onFriend,
    required this.onInstant,
  });
  final List<int>? localScore;
  final VoidCallback onLocal;
  final VoidCallback onFriend;
  final VoidCallback onInstant;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const _SectionTitle(label: 'PLAY ANOTHER WAY'),
        _ModeRow(
          icon: Assets.link,
          title: 'FRIEND',
          subtitle: 'Invite with a link',
          tag: 'SOON',
          onTap: onFriend,
        ),
        _ModeRow(
          icon: Assets.trophy,
          title: 'TOURNAMENT',
          subtitle: 'First to three takes the belt',
          tag: 'NEW',
          onTap: onLocal,
        ),
        _ModeRow(
          icon: Assets.players,
          title: 'LOCAL',
          subtitle: localScore == null
              ? '2 players · one desk'
              : 'Saved score ${localScore!.join('–')}',
          tag: localScore == null ? 'PLAY' : 'RESUME',
          onTap: onLocal,
        ),
        _ModeRow(
          icon: Assets.globe,
          title: 'INSTANT',
          subtitle: 'Find someone online',
          tag: 'SOON',
          onTap: onInstant,
        ),
        const SizedBox(height: 28),
        const _SectionTitle(label: 'YOUR RIVALS'),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 34),
          child: Text(
            'Play a friend and the score settles here.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 19, color: AppColors.inkSoft),
          ),
        ),
        const SizedBox(height: 78),
        const _SectionTitle(label: 'CLASS RANKING'),
        const ListTile(
          leading: Icon(Icons.bar_chart_rounded, color: AppColors.ink),
          title: Text(
            'Unranked',
            style: TextStyle(color: AppColors.ink, fontSize: 22),
          ),
          subtitle: Text('Win a solo match to join the board'),
          trailing: Icon(Icons.chevron_right, color: AppColors.ink),
        ),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: AppColors.rule)),
        Flexible(
          flex: 5,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 25,
                color: AppColors.ink,
                letterSpacing: 1,
              ),
            ),
          ),
        ),
        const Expanded(child: Divider(color: AppColors.rule)),
      ],
    );
  }
}

class _ModeRow extends StatelessWidget {
  const _ModeRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.tag,
    required this.onTap,
  });
  final String icon;
  final String title;
  final String subtitle;
  final String tag;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.rule)),
        ),
        child: Row(
          children: [
            Image.asset(icon, width: 34, height: 34, fit: BoxFit.contain),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 22, color: AppColors.ink),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(color: AppColors.inkSoft),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              color: tag == 'PLAY' ? AppColors.red : AppColors.gold,
              child: Text(
                tag,
                style: const TextStyle(
                  fontFamily: 'Anton',
                  fontSize: 10,
                  color: Colors.white,
                ),
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.ink),
          ],
        ),
      ),
    );
  }
}

class _LockedRow extends StatelessWidget {
  const _LockedRow({
    required this.code,
    required this.title,
    required this.subtitle,
  });
  final String code;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: .48,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.rule)),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 58,
              child: Text(
                code,
                style: const TextStyle(
                  color: AppColors.ink,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(color: AppColors.ink, fontSize: 17),
                  ),
                  Text(subtitle, style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.lock_outline, size: 18),
          ],
        ),
      ),
    );
  }
}
