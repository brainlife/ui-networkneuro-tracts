<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/brand/brainlife-mark-on-dark.svg">
    <img src=".github/brand/brainlife-mark-on-light.svg" alt="brainlife.io" width="140">
  </picture>
</p>

<h1 align="center">ui-networkneuro-tracts</h1>

<p align="center">
  Network neuroscience viewer: connectivity matrix and the tracts behind each connection for brainlife.io datasets.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-maintained-blue.svg" alt="Status: maintained">
  <a href="https://brainlife.io"><img src="https://img.shields.io/badge/brainlife.io-site-3b9fd0.svg" alt="brainlife.io"></a>
  <a href="https://brainlife.io/docs"><img src="https://img.shields.io/badge/Docs-brainlife.io%2Fdocs-005981.svg" alt="Documentation"></a>
  <a href="https://doi.org/10.1038/s41592-024-02237-2"><img src="https://img.shields.io/badge/DOI-10.1038%2Fs41592--024--02237--2-e57536.svg" alt="Nature Methods paper"></a>
</p>

## 🧠 At a glance

| | |
|---|---|
| 🧭 **What** | Static web page (Network neuroscience viewer: connectivity matrix and the tracts behind each connection) that brainlife.io opens for a dataset; it reads the dataset's files through the brainlife API |
| 🗂️ **Datatypes** | `neuro/networkneuro` |
| 🕰️ **Last change** | 2025-03-06 |

## 💻 Run it locally

```bash
git clone https://github.com/brainlife/ui-networkneuro-tracts && cd ui-networkneuro-tracts
npm install            # if package.json lists dependencies
npx http-server .      # or any static server; open index.html
```

brainlife.io serves the built files under `/ui/` and passes the dataset location to the page.

## 📝 Notes

[Demo](https://brainlife.io/ui/nnview/) · [doi:10.25663/brainlife.ui.3](https://doi.org/10.25663/brainlife.ui.3). Author: Soichi Hayashi.

## 🔗 Related

[ui-niivue](https://github.com/brainlife/ui-niivue) (current in-browser viewer) · [abcd-novnc](https://github.com/brainlife/abcd-novnc) (desktop viewer launcher) · [warehouse-next](https://github.com/brainlife/warehouse-next) (datatypes and their viewers)

## 📚 Citing

If you use brainlife.io in your work, please cite:

> Hayashi S, Caron BA, Heinsfeld AS, et al. brainlife.io: a decentralized and open-source cloud platform to support neuroscience research. *Nature Methods* 21:809–813 (2024). [doi:10.1038/s41592-024-02237-2](https://doi.org/10.1038/s41592-024-02237-2)

## 🤝 Contributing

Issues and pull requests are welcome in this repository. For help using brainlife.io, see the [documentation](https://brainlife.io/docs).

## ⚖️ License

This repository does not include a license file yet.

<p align="center"><sub>brainlife.io · Brain data across scales. One place to analyze, share and publish it. · The University of Texas at Austin</sub></p>
