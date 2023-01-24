import './filter.css';

function Filter({ filter }) {
  return (
    <div class="filter">
      <div class="name">
        { filter.title }
        {/* TODO: implement edit filter */}
        <button disabled={true}>Edit</button>
      </div>
      <div class="contents">
        { filter.keywords.length } keywords<br />
        <span class="note">{ filter.keywords.map((k) => k.keyword).join(', ') }</span>
      </div>
    </div>
  );
}

export default Filter;
