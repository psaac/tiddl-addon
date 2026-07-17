# Firefox addon + backend Python local

Ce projet contient :

- une extension Firefox minimale qui ajoute un bouton sur une page cible
- un backend Python local appelé en HTTP quand on clique sur ce bouton

## Setup

Install tiddl ([Github](https://github.com/oskvr37/tiddl/tree/main)):

```bash
cd backend
uv sync
uv tool install --python python3.13 tiddl==3.4.4
```

Create config file (config.toml) in ~/.tiddl to configure download settings

Login into Tidal

```bash
tiddl auth login
```

## Structure

- `firefox-addon/` : extension Firefox
- `backend/main.py` : serveur HTTP local Python

## Configuration de la page cible

Par defaut, l'extension s'injecte sur `https://tidal.com/*`.

Pour changer la page cible, modifie `matches` dans `firefox-addon/manifest.json`.

Exemple :

```json
"matches": ["https://mon-site.exemple/*"]
```

## Demarrer le backend Python

Depuis la racine du projet :

```bash
python3 backend/main.py
```

Le serveur ecoute sur `http://127.0.0.1:8765` et expose `POST /run-script`.

## Charger l'extension dans Firefox

1. Ouvre `about:debugging#/runtime/this-firefox`
2. Clique sur `Load Temporary Add-on`
3. Selectionne `firefox-addon/manifest.json`

## Fonctionnement

- le content script ajoute un bouton de telechargement a cote du bouton lecture du player principal
- au clic, l'extension recupere l'URL du morceau depuis le noeud `a` dans `_currentMediaItemDetails_*`
- le background script appelle le backend Python local
- le backend execute `tiddl download -q max url <mediaUrl>`

## Exemple HTML local

Un exemple de page TIDAL exportee est disponible dans `html/` pour reperer la structure DOM et la zone d'injection autour de `#player__play`.

## Backend tiddl

La logique metier est dans `run_user_script()` dans `backend/main.py`.

Le backend attend `mediaUrl` et lance la commande :

```bash
tiddl download -q max url <mediaUrl>
```

## Test rapide

Une fois le backend lance et l'extension chargee :

1. ouvre une page correspondant a `matches`
2. clique sur `Run Python`
3. verifie le message de succes affiche sur la page

## Limites

- Le backend Python doit etre demarre localement
- Cette version utilise HTTP local, pas Native Messaging
